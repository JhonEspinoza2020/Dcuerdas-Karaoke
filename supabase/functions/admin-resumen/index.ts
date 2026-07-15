import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { inicioJornadaActualIso, claveJornadaDesdeIso } from "../_shared/horario.ts";
import { AgrupadorPersonas, normalizarNombre } from "../_shared/nombres.ts";

function hace30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

type VisitaRow = {
  nombre_cliente: string;
  nombre_norm: string;
  mesa_id: number;
  creado_en: string;
  user_id: string | null;
  mesas: { numero_mesa: number; etiqueta: string | null; tipo: string } | null;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const supabase = createServiceClient();
    const inicioHoy = inicioJornadaActualIso();
    const hace30 = hace30Dias();

    const [
      visitasHoyRes,
      colaRes,
      pedidosRes,
      visitasRes,
    ] = await Promise.all([
      supabase
        .from("visitas_clientes")
        .select("id, nombre_cliente, nombre_norm, mesa_id, creado_en, user_id, mesas(numero_mesa, etiqueta, tipo)")
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
        .select("nombre_cliente, nombre_norm, mesa_id, creado_en, user_id, mesas(numero_mesa, etiqueta, tipo)")
        .order("creado_en", { ascending: false }),
    ]);

    if (visitasHoyRes.error) throw visitasHoyRes.error;
    if (colaRes.error) throw colaRes.error;
    if (pedidosRes.error) throw pedidosRes.error;
    if (visitasRes.error) throw visitasRes.error;

    const todasVisitas = (visitasRes.data ?? []) as VisitaRow[];
    const agrupador = new AgrupadorPersonas();

    // Primera pasada: registrar identidades (user_id + nombres parecidos).
    for (const v of todasVisitas) {
      const norm = normalizarNombre(v.nombre_cliente) || v.nombre_norm;
      agrupador.registrar(norm, v.user_id);
    }

    type Agg = {
      nombre: string;
      total_noches: number;
      visitas_mes: number;
      ultima_visita: string;
      primera_visita: string;
      jornadas: Set<string>;
      jornadasMes: Set<string>;
      mesas: Map<number, { count: number; etiqueta: string }>;
      tuvoAntesDeHoy: boolean;
    };

    const mapa = new Map<string, Agg>();

    for (const v of todasVisitas) {
      const mesa = v.mesas;
      const etiqueta = mesa?.etiqueta ?? (mesa?.tipo === "karaoke" ? "Box Karaoke" : `Mesa ${mesa?.numero_mesa}`);
      const norm = normalizarNombre(v.nombre_cliente) || v.nombre_norm;
      const key = agrupador.claveDe(norm, v.user_id);
      const creado = v.creado_en;
      const jornada = claveJornadaDesdeIso(creado);
      const prev = mapa.get(key);

      if (!prev) {
        const mesas = new Map<number, { count: number; etiqueta: string }>();
        mesas.set(v.mesa_id, { count: 1, etiqueta });
        const jornadas = new Set<string>([jornada]);
        const jornadasMes = new Set<string>();
        if (creado >= hace30) jornadasMes.add(jornada);
        mapa.set(key, {
          nombre: v.nombre_cliente,
          total_noches: 1,
          visitas_mes: jornadasMes.size,
          ultima_visita: creado,
          primera_visita: creado,
          jornadas,
          jornadasMes,
          mesas,
          tuvoAntesDeHoy: creado < inicioHoy,
        });
      } else {
        if (v.nombre_cliente.length > prev.nombre.length) prev.nombre = v.nombre_cliente;
        prev.jornadas.add(jornada);
        prev.total_noches = prev.jornadas.size;
        if (creado >= hace30) {
          prev.jornadasMes.add(jornada);
          prev.visitas_mes = prev.jornadasMes.size;
        }
        if (creado > prev.ultima_visita) prev.ultima_visita = creado;
        if (creado < prev.primera_visita) prev.primera_visita = creado;
        if (creado < inicioHoy) prev.tuvoAntesDeHoy = true;
        const m = prev.mesas.get(v.mesa_id);
        if (m) m.count += 1;
        else prev.mesas.set(v.mesa_id, { count: 1, etiqueta });
      }
    }

    const frecuentes = [...mapa.values()]
      .filter((c) => c.total_noches >= 2)
      .sort((a, b) => b.total_noches - a.total_noches || b.ultima_visita.localeCompare(a.ultima_visita))
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
          total_visitas: c.total_noches,
          visitas_mes: c.visitas_mes,
          ultima_visita: c.ultima_visita,
          primera_visita: c.primera_visita,
          mesa_habitual: mesaHabitual,
        };
      });

    // Una fila por persona en la jornada (no una por mesa).
    const llegadasPorPersona = new Map<string, {
      nombre: string;
      zona: string;
      hora: string;
      es_recurrente: boolean;
      total_visitas: number;
    }>();

    for (const v of (visitasHoyRes.data ?? []) as VisitaRow[]) {
      const mesa = v.mesas;
      const etiqueta = mesa?.etiqueta ?? (mesa?.tipo === "karaoke" ? "Box Karaoke" : `Mesa ${mesa?.numero_mesa}`);
      const norm = normalizarNombre(v.nombre_cliente) || v.nombre_norm;
      const key = agrupador.claveDe(norm, v.user_id);
      const agg = mapa.get(key);
      const total = agg?.total_noches ?? 1;
      const esRecurrente = Boolean(agg?.tuvoAntesDeHoy) || total >= 2;
      const prev = llegadasPorPersona.get(key);
      if (!prev || v.creado_en > prev.hora) {
        llegadasPorPersona.set(key, {
          nombre: (agg?.nombre && agg.nombre.length >= v.nombre_cliente.length)
            ? agg.nombre
            : v.nombre_cliente,
          zona: etiqueta,
          hora: v.creado_en,
          es_recurrente: esRecurrente,
          total_visitas: total,
        });
      } else if (esRecurrente) {
        prev.es_recurrente = true;
      }
    }

    const llegadasHoy = [...llegadasPorPersona.values()]
      .sort((a, b) => b.hora.localeCompare(a.hora));

    return jsonResponse({
      stats: {
        visitas_hoy: (visitasHoyRes.data ?? []).length,
        clientes_hoy: llegadasHoy.length,
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
