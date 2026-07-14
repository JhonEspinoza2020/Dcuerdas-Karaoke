import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "PATCH") {
    return errorResponse("metodo_no_permitido", "Usa PATCH.", 405);
  }

  try {
    await verifyAdminAuth(req);
    const { cancion_id, estado } = await req.json();

    if (!["reproduciendo", "completada"].includes(estado)) {
      return errorResponse("estado_invalido", "Estado no válido.", 400);
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("cola_reproduccion")
      .update({ estado })
      .eq("id", cancion_id)
      .select("*, mesas(numero_mesa, tipo, etiqueta)")
      .single();

    if (error) throw error;
    if (!data) return errorResponse("no_encontrada", "Canción no encontrada.", 404);

    return jsonResponse({
      id: data.id,
      mesa_id: data.mesa_id,
      numero_mesa: data.mesas?.numero_mesa,
      tipo: data.mesas?.tipo ?? "mesa",
      etiqueta: data.mesas?.etiqueta ?? `Mesa ${data.mesas?.numero_mesa}`,
      youtube_video_id: data.youtube_video_id,
      titulo_cancion: data.titulo_cancion,
      nombre_cliente: data.nombre_cliente,
      saludo: data.saludo,
      saludo_momento: data.saludo_momento ?? "inicio",
      estado: data.estado,
      creado_en: data.creado_en,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error al actualizar.", 500);
  }
});
