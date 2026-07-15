import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { verifyAdminAuth } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { obtenerBloqueados } from "../_shared/youtube_embed.ts";

type VideoAmbiente = {
  video_id: string;
  titulo: string;
  preferida: boolean;
};

function esShort(titulo: string): boolean {
  const t = titulo.toLowerCase();
  return /#\s*shorts?\b/.test(t) || /\byoutube\s*shorts?\b/.test(t);
}

function esLetraOKaraoke(titulo: string): boolean {
  return /\b(karaoke|letra|lyrics|pista)\b/i.test(titulo);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    await verifyAdminAuth(req);
    const supabase = createServiceClient();
    const porId = new Map<string, VideoAmbiente>();

    const page = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("cola_reproduccion")
        .select("youtube_video_id, titulo_cancion")
        .order("creado_en", { ascending: false })
        .range(from, from + page - 1);

      if (error) throw error;
      const filas = data ?? [];
      for (const fila of filas) {
        const id = fila.youtube_video_id as string | null;
        const titulo = (fila.titulo_cancion as string) ?? "Sin título";
        if (!id || id.length < 6 || esShort(titulo)) continue;
        if (porId.has(id)) continue;
        porId.set(id, {
          video_id: id,
          titulo,
          preferida: esLetraOKaraoke(titulo),
        });
      }
      if (filas.length < page) break;
      from += page;
      if (from > 20000) break;
    }

    const bloqueados = await obtenerBloqueados([...porId.keys()]);
    const videos = [...porId.values()]
      .filter((v) => !bloqueados.has(v.video_id))
      .sort((a, b) => {
        if (a.preferida !== b.preferida) return a.preferida ? -1 : 1;
        return 0;
      });

    return jsonResponse({
      videos,
      total: videos.length,
      fuente: "enviadas_todas",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "admin_no_autorizado") return errorResponse(msg, "No autorizado.", 403);
    return errorResponse("error", "Error al leer ambiente.", 500);
  }
});
