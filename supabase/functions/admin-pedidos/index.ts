import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { inicioJornadaActualIso } from "../_shared/horario.ts";

const ESTADOS_VALIDOS = ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"];
const ACTIVOS = ["pendiente", "en_preparacion", "listo"] as const;
const CERRADOS = ["entregado", "cancelado"] as const;

type MesaJoin = { numero_mesa: number; etiqueta: string | null; tipo: string } | null;

type PedidoItemRow = {
  id: number;
  plato_nombre: string;
  cantidad: number;
  nota: string | null;
  precio_unitario?: number | null;
};

function inicioDiaLimaIso(): string {
  const lima = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  lima.setHours(0, 0, 0, 0);
  return lima.toISOString();
}

function parseFechaIso(raw: unknown, finDelDia = false): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  // YYYY-MM-DD → día completo en Lima
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const local = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
    local.setFullYear(y, m - 1, d);
    if (finDelDia) local.setHours(23, 59, 59, 999);
    else local.setHours(0, 0, 0, 0);
    return local.toISOString();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function mapPedido(p: Record<string, unknown>) {
  const mesa = p.mesas as MesaJoin;
  const zona = mesa?.etiqueta ?? (mesa?.tipo === "karaoke" ? "Box Karaoke" : `Mesa ${mesa?.numero_mesa}`);
  const items = ((p.pedido_items as PedidoItemRow[] | null) ?? []).map((item) => ({
    id: item.id,
    plato_nombre: item.plato_nombre,
    cantidad: item.cantidad,
    nota: item.nota,
    precio_unitario: Number(item.precio_unitario) || 0,
  }));
  const subtotal = items.reduce(
    (s, item) => s + item.precio_unitario * item.cantidad,
    0,
  );
  return {
    id: p.id,
    nombre_cliente: p.nombre_cliente,
    zona,
    num_personas: p.num_personas,
    nota_cocina: p.nota_cocina,
    telefono: p.telefono,
    estado: p.estado,
    creado_en: p.creado_en,
    archivado_en: p.archivado_en ?? null,
    items,
    subtotal,
  };
}

function rangoCerrados(filtro: string, desdeRaw: unknown, hastaRaw: unknown) {
  if (filtro === "hoy") {
    return { desde: inicioDiaLimaIso(), hasta: null as string | null };
  }
  if (filtro === "rango") {
    return {
      desde: parseFechaIso(desdeRaw, false) ?? inicioJornadaActualIso(),
      hasta: parseFechaIso(hastaRaw, true),
    };
  }
  // jornada (default)
  return { desde: inicioJornadaActualIso(), hasta: null as string | null };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const supabase = createServiceClient();

    if (req.method === "GET" || req.method === "POST") {
      let filtro = "jornada";
      let desdeRaw: unknown = null;
      let hastaRaw: unknown = null;

      if (req.method === "GET") {
        const url = new URL(req.url);
        filtro = url.searchParams.get("filtro") ?? "jornada";
        desdeRaw = url.searchParams.get("desde");
        hastaRaw = url.searchParams.get("hasta");
      } else {
        try {
          const body = await req.json();
          filtro = String(body?.filtro ?? "jornada");
          desdeRaw = body?.desde ?? null;
          hastaRaw = body?.hasta ?? null;
        } catch {
          /* body vacío = jornada */
        }
      }

      const { desde, hasta } = rangoCerrados(filtro, desdeRaw, hastaRaw);
      const select = "*, mesas(numero_mesa, etiqueta, tipo), pedido_items(*)";

      let cerradosQ = supabase
        .from("pedidos")
        .select(select)
        .in("estado", [...CERRADOS])
        .gte("creado_en", desde)
        .order("creado_en", { ascending: false })
        .limit(100);

      if (hasta) {
        cerradosQ = cerradosQ.lte("creado_en", hasta);
      }

      const [activosRes, cerradosRes] = await Promise.all([
        supabase
          .from("pedidos")
          .select(select)
          .in("estado", [...ACTIVOS])
          .order("creado_en", { ascending: true }),
        cerradosQ,
      ]);

      if (activosRes.error) throw activosRes.error;
      if (cerradosRes.error) throw cerradosRes.error;

      const pedidos = [
        ...(activosRes.data ?? []).map(mapPedido),
        ...(cerradosRes.data ?? []).map(mapPedido),
      ];

      return jsonResponse(pedidos);
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      const { pedido_id, estado } = body;
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return errorResponse("estado_invalido", "Estado no válido.", 400);
      }

      const { data, error } = await supabase
        .from("pedidos")
        .update({ estado })
        .eq("id", Number(pedido_id))
        .select("id, estado")
        .single();

      if (error) throw error;
      return jsonResponse(data);
    }

    return errorResponse("metodo_no_soportado", "Método no soportado.", 405);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error en pedidos.", 500);
  }
});
