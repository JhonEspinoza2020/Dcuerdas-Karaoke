import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { marcarVideoBloqueado } from "../_shared/youtube_embed.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const body = await req.json();
    const videoId = String(body.video_id ?? "").trim();
    if (videoId.length < 6) {
      return errorResponse("video_invalido", "ID inválido.", 400);
    }
    const motivo = String(body.motivo ?? "player_error").slice(0, 200);
    await marcarVideoBloqueado(videoId, motivo);
    return jsonResponse({ ok: true, video_id: videoId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "No se pudo marcar el video.", 500);
  }
});
