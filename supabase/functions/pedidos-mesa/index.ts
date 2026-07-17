import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { inicioJornadaActualIso } from "../_shared/horario.ts";
import { exigirCooldownMesa } from "../_shared/mesa_rate.ts";

const ESTADOS_VISIBLES = ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"];

function idsValidos(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  )].slice(0, 10);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const mesa = await validarMesaToken(Number(body.numero_mesa), String(body.token));
    try {
      await exigirCooldownMesa(mesa.id, "pedidos_mesa", 5);
    } catch (e) {
      if (e instanceof Error && e.message === "rate_limit") {
        return errorResponse("rate_limit", "Espera unos segundos antes de consultar de nuevo.", 429);
      }
      throw e;
    }
    const pedidoIds = idsValidos(body.pedido_ids);
    const inicioJornada = inicioJornadaActualIso();
    const supabase = createServiceClient();

    let query = supabase
      .from("pedidos")
      .select("id, estado, creado_en, pedido_items(id, plato_nombre, cantidad, nota)")
      .eq("mesa_id", mesa.id)
      .in("estado", ESTADOS_VISIBLES)
      .gte("creado_en", inicioJornada)
      .order("creado_en", { ascending: false })
      .limit(20);

    if (pedidoIds.length > 0) {
      query = query.in("id", pedidoIds);
    } else {
      query = query.in("estado", ["pendiente", "en_preparacion", "listo"]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const pedidos = (data ?? []).map((p) => ({
      id: p.id,
      estado: p.estado,
      creado_en: p.creado_en,
      items: p.pedido_items ?? [],
    }));

    return jsonResponse({ pedidos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    if (msg === "rate_limit") {
      return errorResponse(msg, "Espera unos segundos antes de consultar de nuevo.", 429);
    }
    return errorResponse("error", "Error al consultar pedidos.", 500);
  }
});
