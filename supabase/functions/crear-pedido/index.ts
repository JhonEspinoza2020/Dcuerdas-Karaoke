import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { filtrarTexto } from "../_shared/content_filter.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const mesa = await validarMesaToken(Number(body.numero_mesa), String(body.token));

    const nombreCliente = filtrarTexto(String(body.nombre_cliente), "nombre");
    const notaCocina = body.nota_cocina
      ? filtrarTexto(String(body.nota_cocina), "nota")
      : null;

    const items: Array<{ plato_id: number; plato_nombre: string; cantidad: number; nota?: string }> =
      Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return errorResponse("pedido_vacio", "Agrega al menos un plato.", 400);
    }

    const supabase = createServiceClient();

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .insert({
        mesa_id: mesa.id,
        nombre_cliente: nombreCliente,
        num_personas: body.num_personas ? Number(body.num_personas) : null,
        nota_cocina: notaCocina,
        telefono: body.telefono ? String(body.telefono).slice(0, 20) : null,
        estado: "pendiente",
      })
      .select()
      .single();

    if (pedidoErr) throw pedidoErr;

    const itemsInsert = items.map((item) => ({
      pedido_id: pedido.id,
      plato_id: item.plato_id,
      plato_nombre: String(item.plato_nombre).slice(0, 150),
      cantidad: Math.min(20, Math.max(1, Number(item.cantidad) || 1)),
      nota: item.nota ? String(item.nota).slice(0, 200) : null,
    }));

    const { error: itemsErr } = await supabase.from("pedido_items").insert(itemsInsert);
    if (itemsErr) throw itemsErr;

    return jsonResponse({
      pedido_id: pedido.id,
      mesa: mesa.numero_mesa,
      mensaje: "¡Pedido enviado a cocina!",
    }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg.startsWith("contenido_no_permitido")) {
      return errorResponse("contenido_no_permitido", "Texto no permitido.", 422);
    }
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    return errorResponse("error", "Error al crear pedido.", 500);
  }
});
