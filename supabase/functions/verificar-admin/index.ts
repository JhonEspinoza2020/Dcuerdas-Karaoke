import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const admin = await verifyAdminAuth(req);
    return jsonResponse({
      es_admin: true,
      email: admin.email,
      rol: admin.rol,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") {
      return jsonResponse({ es_admin: false, detail: "No tienes permisos de administrador." });
    }
    return errorResponse("error", "Error al verificar.", 500);
  }
});
