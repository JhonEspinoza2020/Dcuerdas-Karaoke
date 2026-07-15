import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { validarMesaToken } from "../_shared/mesa.ts";
import { validarHorario } from "../_shared/horario.ts";
import {
  buscarCacheAproximado,
  guardarCacheYoutube,
  leerCacheYoutube,
  normalizarTerminoBusqueda,
  type VideoCacheItem,
} from "../_shared/youtube_cache.ts";
import {
  cuotaDisponible,
  marcarApiMesa,
  mesaPuedeLlamarApi,
  registrarBusquedaApi,
} from "../_shared/youtube_cuota.ts";

const REGION = Deno.env.get("YOUTUBE_REGION") ?? "PE";

/**
 * Preferencia suave (no filtra): karaoke/letra un poco arriba,
 * pero se muestran también clips normales si YouTube los deja embeber.
 */
function scorePreferencia(titulo: string): number {
  const t = titulo.toLowerCase();
  let s = 0;
  if (/\bkaraoke\b/.test(t)) s += 2;
  if (/\b(letra|lyrics|pista)\b/.test(t)) s += 1;
  if (/\bsing[- ]?along\b/.test(t)) s += 1;
  return s;
}

function ordenarPreferenciaSuave(items: VideoCacheItem[]): VideoCacheItem[] {
  return [...items].sort(
    (a, b) => scorePreferencia(b.titulo) - scorePreferencia(a.titulo),
  );
}

/** Solo videos que SÍ se pueden embeber (sin fallback a los bloqueados). */
async function filtrarReproducibles(
  candidatos: VideoCacheItem[],
  apiKey: string,
): Promise<VideoCacheItem[]> {
  if (candidatos.length === 0) return [];
  const ids = candidatos.map((c) => c.video_id).join(",");
  const params = new URLSearchParams({
    part: "status,contentDetails",
    id: ids,
    key: apiKey,
  });

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) return [];
    const data = await res.json();

    const reproducibles = new Set<string>();
    for (const v of data.items ?? []) {
      const id = v.id as string;
      const status = v.status as { embeddable?: boolean; privacyStatus?: string } | undefined;
      const region = (v.contentDetails as { regionRestriction?: { blocked?: string[]; allowed?: string[] } } | undefined)
        ?.regionRestriction;

      const embebible = status?.embeddable !== false;
      const publico = status?.privacyStatus === "public" || status?.privacyStatus === undefined;
      const bloqueadoAqui = region?.blocked?.includes(REGION) ?? false;
      const permitidoAqui = region?.allowed ? region.allowed.includes(REGION) : true;

      if (embebible && publico && !bloqueadoAqui && permitidoAqui) {
        reproducibles.add(id);
      }
    }

    return ordenarPreferenciaSuave(
      candidatos.filter((c) => reproducibles.has(c.video_id)),
    );
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    validarHorario();
    const { numero_mesa, token, q } = await req.json();
    const numeroMesa = Number(numero_mesa);
    const mesa = await validarMesaToken(numeroMesa, String(token));

    // Búsqueda normal (sin forzar "karaoke"). Si el cliente lo escribe, se respeta.
    // Karaoke/letra solo reciben un boost suave al ordenar resultados.
    const termino = normalizarTerminoBusqueda(String(q), "musica");
    const limpio = termino.trim();
    if (limpio.length < 2) {
      return jsonResponse({ resultados: [], total: 0, cache: "skip", fuente: "skip" });
    }

    const enCache = await leerCacheYoutube(termino);
    if (enCache?.length) {
      const resultados = ordenarPreferenciaSuave(enCache);
      return jsonResponse({
        resultados,
        total: resultados.length,
        cache: "hit",
        fuente: "cache",
      });
    }

    const aprox = (await buscarCacheAproximado(termino)) ?? [];
    if (aprox.length >= 5) {
      const resultados = ordenarPreferenciaSuave(aprox);
      return jsonResponse({
        resultados,
        total: resultados.length,
        cache: "hit",
        fuente: "cache_aprox",
      });
    }

    const cuota = await cuotaDisponible();
    const mesaOk = await mesaPuedeLlamarApi(mesa.id);
    if (!cuota.ok || !mesaOk) {
      if (aprox.length > 0) {
        const resultados = ordenarPreferenciaSuave(aprox);
        return jsonResponse({
          resultados,
          total: resultados.length,
          cache: "hit",
          fuente: "ahorro",
          aviso: cuota.ok
            ? "Espera unos segundos para buscar de nuevo."
            : "Cupo de búsquedas de hoy al límite; mostrando resultados guardados.",
        });
      }
      return errorResponse(
        "cuota_youtube",
        cuota.ok
          ? "Espera unos segundos antes de buscar otra canción."
          : "Se agotó el cupo de búsquedas nuevas de hoy.",
        429,
      );
    }

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      return errorResponse("youtube_no_configurado", "La búsqueda estará disponible pronto.", 503);
    }

    const params = new URLSearchParams({
      part: "snippet",
      q: termino,
      type: "video",
      maxResults: "15",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      safeSearch: "moderate",
      key: apiKey,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!res.ok) {
      if (aprox.length > 0) {
        const resultados = ordenarPreferenciaSuave(aprox);
        return jsonResponse({
          resultados,
          total: resultados.length,
          cache: "hit",
          fuente: "ahorro",
          aviso: "YouTube no respondió; mostrando sugerencias guardadas.",
        });
      }
      return errorResponse("youtube_error", "YouTube rechazó la solicitud.", 502);
    }

    await registrarBusquedaApi();
    await marcarApiMesa(mesa.id);

    const data = await res.json();
    const candidatos: VideoCacheItem[] = (data.items ?? [])
      .filter((item: { id?: { videoId?: string } }) => item.id?.videoId)
      .map((item: { id: { videoId: string }; snippet: Record<string, unknown> }) => {
        const thumbs = item.snippet.thumbnails as Record<string, { url?: string }>;
        return {
          video_id: item.id.videoId,
          titulo: item.snippet.title ?? "Sin título",
          miniatura_url: thumbs?.medium?.url ?? thumbs?.default?.url ?? "",
          canal: item.snippet.channelTitle ?? null,
        };
      });

    // Verificación real: embeddable=true. Si ninguno sirve, lista vacía (no ofrecer invalidos).
    const resultados = await filtrarReproducibles(candidatos, apiKey);

    if (resultados.length > 0) {
      await guardarCacheYoutube(termino, resultados);
    }

    return jsonResponse({
      resultados,
      total: resultados.length,
      cache: "miss",
      fuente: "youtube",
      cuota: { usadas: cuota.usadas + 1, max: cuota.max },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg.startsWith("fuera_de_horario")) {
      const [, inicio, fin] = msg.split(":");
      return errorResponse("fuera_de_horario", `Disponible de ${inicio} a ${fin}.`, 403);
    }
    if (msg === "token_invalido") return errorResponse(msg, "Token inválido.", 403);
    if (msg === "mesa_no_encontrada") return errorResponse(msg, "Mesa no encontrada.", 404);
    return errorResponse("error", "Error al buscar.", 500);
  }
});
