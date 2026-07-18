import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { ejecutarBusquedaYoutube } from "../_shared/youtube_buscar.ts";
import { exigirRateLimitAdmin } from "../_shared/mesa_rate.ts";

const ADMIN_BUSQUEDAS_POR_MIN = 12;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const admin = await verifyAdminAuth(req);
    const body = await req.json();
    const q = String(body.q ?? "").trim();
    if (q.length > 80) {
      return errorResponse("busqueda_muy_larga", "La búsqueda es demasiado larga.", 400);
    }
    await exigirRateLimitAdmin(
      admin.userId || admin.email,
      "youtube_buscar",
      ADMIN_BUSQUEDAS_POR_MIN,
    );
    const res = await ejecutarBusquedaYoutube({ q, esAdmin: true });
    return jsonResponse(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    if (msg === "rate_limit") {
      return errorResponse(msg, "Demasiadas búsquedas. Espera unos segundos.", 429);
    }
    if (msg === "cuota_youtube") {
      return errorResponse("cuota_youtube", "Se agotó el cupo de búsquedas nuevas de hoy.", 429);
    }
    if (msg === "youtube_no_configurado") {
      return errorResponse(msg, "La búsqueda estará disponible pronto.", 503);
    }
    if (msg === "youtube_error") {
      return errorResponse(msg, "YouTube rechazó la solicitud.", 502);
    }
    return errorResponse("error", "Error al buscar.", 500);
  }
});
