import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { marcarVideoBloqueado } from "../_shared/youtube_embed.ts";

/** El celular detectó que el video no embebe → lo aprendemos. */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json();
    await validarMesaToken(Number(body.numero_mesa), String(body.token));
    const videoId = String(body.video_id ?? "").trim();
    if (videoId.length < 6) {
      return errorResponse("video_invalido", "ID inválido.", 400);
    }
    await marcarVideoBloqueado(videoId, String(body.motivo ?? "cliente_preflight").slice(0, 200));
    return jsonResponse({ ok: true, video_id: videoId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    return errorResponse("error", "No se pudo reportar.", 500);
  }
});
