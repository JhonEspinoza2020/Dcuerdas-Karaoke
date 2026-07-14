import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { numero_mesa, token } = await req.json();
    const mesa = await validarMesaToken(Number(numero_mesa), String(token));
    return jsonResponse({
      mesa_id: mesa.id,
      numero_mesa: mesa.numero_mesa,
      tipo: mesa.tipo,
      etiqueta: mesa.etiqueta,
      nombre_local: "D'cuerdas Resto-Bar",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    return errorResponse("error", "Error al validar mesa.", 500);
  }
});
