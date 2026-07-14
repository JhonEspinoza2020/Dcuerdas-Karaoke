import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const TIMEZONE = "America/Lima";

function inicioDiaLima(): string {
  const ahora = new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE }),
  );
  ahora.setHours(0, 0, 0, 0);
  return ahora.toISOString();
}

function hace30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const supabase = createServiceClient();
    const inicioHoy = inicioDiaLima();
    const hace30 = hace30Dias();

    const [
      visitasHoyRes,
      colaRes,
      pedidosRes,
      visitasRes,
    ] = await Promise.all([
      supabase
        .from("visitas_clientes")
        .select("id, nombre_cliente, nombre_norm, mesa_id, creado_en, mesas(numero_mesa, etiqueta, tipo)")
        .gte("creado_en", inicioHoy)
        .order("creado_en", { ascending: false }),
      supabase
        .from("cola_reproduccion")
        .select("id", { count: "exact", head: true })
        .in("estado", ["pendiente", "reproduciendo"]),
      supabase
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .in("estado", ["pendiente", "en_preparacion"]),
      supabase
        .from("visitas_clientes")
        .select("nombre_cliente, nombre_norm, mesa_id, creado_en, mesas(numero_mesa, etiqueta, tipo)")
        .order("creado_en", { ascending: false }),
    ]);

    if (visitasHoyRes.error) throw visitasHoyRes.error;
    if (colaRes.error) throw colaRes.error;
    if (pedidosRes.error) throw pedidosRes.error;
    if (visitasRes.error) throw visitasRes.error;

    const todasVisitas = visitasRes.data ?? [];
    const mapa = new Map<string, {
      nombre: string;
      nombre_norm: string;
      total_visitas: number;
      visitas_mes: number;
      ultima_visita: string;
      primera_visita: string;
      mesas: Map<number, { count: number; etiqueta: string }>;
    }>();

    for (const v of todasVisitas) {
      const mesa = v.mesas as { numero_mesa: number; etiqueta: string | null; tipo: string } | null;
      const etiqueta = mesa?.etiqueta ?? (mesa?.tipo === "karaoke" ? "Box Karaoke" : `Mesa ${mesa?.numero_mesa}`);
      const key = v.nombre_norm;
      const prev = mapa.get(key);
      const creado = v.creado_en as string;

      if (!prev) {
        const mesas = new Map<number, { count: number; etiqueta: string }>();
        mesas.set(v.mesa_id, { count: 1, etiqueta });
        mapa.set(key, {
          nombre: v.nombre_cliente,
          nombre_norm: key,
          total_visitas: 1,
          visitas_mes: creado >= hace30 ? 1 : 0,
          ultima_visita: creado,
          primera_visita: creado,
          mesas,
        });
      } else {
        prev.total_visitas += 1;
        if (creado >= hace30) prev.visitas_mes += 1;
        if (creado > prev.ultima_visita) prev.ultima_visita = creado;
        if (creado < prev.primera_visita) prev.primera_visita = creado;
        const m = prev.mesas.get(v.mesa_id);
        if (m) m.count += 1;
        else prev.mesas.set(v.mesa_id, { count: 1, etiqueta });
      }
    }

    const frecuentes = [...mapa.values()]
      .filter((c) => c.total_visitas >= 2)
      .sort((a, b) => b.total_visitas - a.total_visitas || b.ultima_visita.localeCompare(a.ultima_visita))
      .slice(0, 50)
      .map((c) => {
        let mesaHabitual = "";
        let maxCount = 0;
        for (const [, m] of c.mesas) {
          if (m.count > maxCount) {
            maxCount = m.count;
            mesaHabitual = m.etiqueta;
          }
        }
        return {
          nombre: c.nombre,
          total_visitas: c.total_visitas,
          visitas_mes: c.visitas_mes,
          ultima_visita: c.ultima_visita,
          primera_visita: c.primera_visita,
          mesa_habitual: mesaHabitual,
        };
      });

    const nombresConHistorial = new Set(
      todasVisitas
        .filter((v) => v.creado_en < inicioHoy)
        .map((v) => v.nombre_norm),
    );

    const llegadasHoy = (visitasHoyRes.data ?? []).map((v) => {
      const mesa = v.mesas as { numero_mesa: number; etiqueta: string | null; tipo: string } | null;
      const etiqueta = mesa?.etiqueta ?? (mesa?.tipo === "karaoke" ? "Box Karaoke" : `Mesa ${mesa?.numero_mesa}`);
      const total = mapa.get(v.nombre_norm)?.total_visitas ?? 1;
      return {
        nombre: v.nombre_cliente,
        zona: etiqueta,
        hora: v.creado_en,
        es_recurrente: nombresConHistorial.has(v.nombre_norm) || total >= 2,
        total_visitas: total,
      };
    });

    const clientesUnicosHoy = new Set((visitasHoyRes.data ?? []).map((v) => v.nombre_norm)).size;

    return jsonResponse({
      stats: {
        visitas_hoy: visitasHoyRes.data?.length ?? 0,
        clientes_hoy: clientesUnicosHoy,
        cola_activa: colaRes.count ?? 0,
        pedidos_pendientes: pedidosRes.count ?? 0,
        clientes_frecuentes: frecuentes.length,
      },
      llegadas_hoy: llegadasHoy,
      frecuentes,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error al obtener resumen.", 500);
  }
});
