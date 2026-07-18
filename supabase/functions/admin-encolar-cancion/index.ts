import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { videoEsReproducible } from "../_shared/youtube_embed.ts";

/** Admin encola sin límite de mesa ni rate limit de canciones. */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const body = await req.json();
    const videoId = String(body.youtube_video_id ?? "").trim();
    const titulo = String(body.titulo_cancion ?? "").trim() || "Sin título";
    const nombre = String(body.nombre_cliente ?? "Local").trim() || "Local";

    if (videoId.length < 6) {
      return errorResponse("video_invalido", "Elige otra canción de la lista.", 400);
    }

    const apiKey = Deno.env.get("YOUTUBE_API_KEY") ?? null;
    const check = await videoEsReproducible(videoId, apiKey);
    if (!check.ok) {
      return errorResponse(
        "video_no_reproducible",
        "Ese video no se puede reproducir en el local. Elige otra versión (letra/karaoke).",
        422,
      );
    }

    const supabase = createServiceClient();
    const { data: mesa, error: mesaErr } = await supabase
      .from("mesas")
      .select("id, numero_mesa")
      .eq("activa", true)
      .order("numero_mesa")
      .limit(1)
      .maybeSingle();

    if (mesaErr || !mesa) {
      return errorResponse("mesa_no_encontrada", "No hay mesas activas para encolar.", 404);
    }

    const { data: cancion, error } = await supabase
      .from("cola_reproduccion")
      .insert({
        mesa_id: mesa.id,
        youtube_video_id: videoId,
        titulo_cancion: titulo.slice(0, 255),
        nombre_cliente: nombre.slice(0, 80),
        saludo: null,
        saludo_momento: "inicio",
        estado: "pendiente",
      })
      .select("*, mesas(numero_mesa, etiqueta, tipo)")
      .single();

    if (error) throw error;

    const { count: totalPendientes } = await supabase
      .from("cola_reproduccion")
      .select("id", { count: "exact", head: true })
      .in("estado", ["pendiente", "reproduciendo"])
      .lte("creado_en", cancion.creado_en);

    const m = cancion.mesas as { numero_mesa: number; etiqueta: string | null; tipo: string } | null;

    return jsonResponse({
      id: cancion.id,
      mesa_id: cancion.mesa_id,
      numero_mesa: m?.numero_mesa ?? mesa.numero_mesa,
      youtube_video_id: cancion.youtube_video_id,
      titulo_cancion: cancion.titulo_cancion,
      nombre_cliente: cancion.nombre_cliente,
      saludo: cancion.saludo,
      saludo_momento: cancion.saludo_momento,
      estado: cancion.estado,
      creado_en: cancion.creado_en,
      posicion: totalPendientes ?? 1,
      etiqueta: m?.etiqueta ?? "Local",
      tipo: m?.tipo ?? "mesa",
    }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error al encolar.", 500);
  }
});
