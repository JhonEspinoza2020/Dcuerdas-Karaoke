import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { filtrarTexto } from "../_shared/content_filter.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const MAX_ITEMS = 30;
const MAX_NOMBRE = 20;
const MAX_NOTA = 180;
const COOLDOWN_PEDIDO_SEG = 10;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    const mesa = await validarMesaToken(Number(body.numero_mesa), String(body.token));

    const nombreCliente = filtrarTexto(String(body.nombre_cliente ?? ""), "nombre")
      .replace(/\s+/g, " ")
      .trim();
    if (nombreCliente.length < 2 || nombreCliente.length > MAX_NOMBRE) {
      return errorResponse("nombre_invalido", "Nombre inválido.", 400);
    }
    const notaCocina = body.nota_cocina
      ? filtrarTexto(String(body.nota_cocina), "nota")
      : null;
    if (notaCocina && notaCocina.length > MAX_NOTA) {
      return errorResponse(
        "nota_muy_larga",
        `La nota puede tener hasta ${MAX_NOTA} caracteres.`,
        400,
      );
    }

    const items: Array<{ plato_id: number; plato_nombre: string; cantidad: number; nota?: string }> =
      Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return errorResponse("pedido_vacio", "Agrega al menos un plato.", 400);
    }
    if (items.length > MAX_ITEMS) {
      return errorResponse("pedido_muy_grande", "Demasiados platos en un solo pedido.", 400);
    }

    const supabase = createServiceClient();
    const { data: claimOk, error: claimErr } = await supabase.rpc(
      "claim_mesa_pedido_cooldown",
      { p_mesa_id: mesa.id, p_segundos: COOLDOWN_PEDIDO_SEG },
    );
    if (claimErr) throw claimErr;
    if (!claimOk) {
      return errorResponse(
        "pedido_rate_limit",
        `Espera ${COOLDOWN_PEDIDO_SEG} segundos antes de enviar otro pedido.`,
        429,
      );
    }

    const ids = [...new Set(items.map((item) => Number(item.plato_id)))];
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      return errorResponse("plato_invalido", "Hay un plato inválido en el pedido.", 400);
    }
    const { data: platosValidos, error: platosErr } = await supabase
      .from("platos")
      .select("id, nombre, precio")
      .in("id", ids)
      .eq("disponible", true);
    if (platosErr) throw platosErr;
    if ((platosValidos ?? []).length !== ids.length) {
      return errorResponse(
        "plato_no_disponible",
        "Uno de los platos ya no está disponible. Actualiza la carta.",
        409,
      );
    }
    const platoPorId = new Map(
      (platosValidos ?? []).map((plato) => [
        plato.id as number,
        { nombre: plato.nombre as string, precio: Number(plato.precio) || 0 },
      ]),
    );

    const personas = body.num_personas ? Number(body.num_personas) : null;
    if (personas !== null && (!Number.isInteger(personas) || personas < 1 || personas > 30)) {
      return errorResponse("personas_invalidas", "Cantidad de personas inválida.", 400);
    }
    const telefonoRaw = String(body.telefono ?? "").trim();
    const telefono = telefonoRaw
      ? telefonoRaw.replace(/[^\d+ ()-]/g, "").slice(0, 20)
      : null;

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .insert({
        mesa_id: mesa.id,
        nombre_cliente: nombreCliente,
        num_personas: personas,
        nota_cocina: notaCocina,
        telefono,
        estado: "pendiente",
      })
      .select()
      .single();

    if (pedidoErr) throw pedidoErr;

    const itemsInsert = items.map((item) => {
      const plato = platoPorId.get(Number(item.plato_id))!;
      return {
        pedido_id: pedido.id,
        plato_id: Number(item.plato_id),
        plato_nombre: plato.nombre,
        cantidad: Math.min(20, Math.max(1, Number(item.cantidad) || 1)),
        precio_unitario: plato.precio,
        nota: item.nota
          ? filtrarTexto(String(item.nota), "nota_item").slice(0, MAX_NOTA)
          : null,
      };
    });

    const { error: itemsErr } = await supabase.from("pedido_items").insert(itemsInsert);
    if (itemsErr) {
      await supabase.from("pedidos").delete().eq("id", pedido.id);
      throw itemsErr;
    }

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
