import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const base = (Deno.env.get("FRONTEND_BASE_URL") ?? "https://dcuerdas.vercel.app").replace(/\/$/, "");
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("mesas")
      .select("numero_mesa, token_seguridad, tipo, etiqueta")
      .eq("activa", true)
      .order("numero_mesa");

    if (error) throw error;

    const qrs = (data ?? []).map((m) => {
      const ruta = m.tipo === "karaoke" ? "box" : "mesa";
      return {
        numero_mesa: m.numero_mesa,
        tipo: m.tipo,
        etiqueta: m.etiqueta ?? `Mesa ${m.numero_mesa}`,
        url: `${base}/${ruta}/${m.numero_mesa}?t=${m.token_seguridad}`,
        token_seguridad: m.token_seguridad,
      };
    });

    return jsonResponse(qrs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error al obtener QRs.", 500);
  }
});
