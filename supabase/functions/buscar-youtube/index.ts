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
import { buscarEnCatalogo } from "../_shared/catalogo_musica.ts";
import {
  cuotaDisponible,
  marcarApiMesa,
  mesaPuedeLlamarApi,
  registrarBusquedaApi,
} from "../_shared/youtube_cuota.ts";

const REGION = Deno.env.get("YOUTUBE_REGION") ?? "PE";

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
    if (!res.ok) return candidatos;
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

    const filtrados = candidatos.filter((c) => reproducibles.has(c.video_id));
    return filtrados.length > 0 ? filtrados : candidatos;
  } catch {
    return candidatos;
  }
}

function mergeUnicos(...listas: VideoCacheItem[][]): VideoCacheItem[] {
  const vistos = new Set<string>();
  const out: VideoCacheItem[] = [];
  for (const lista of listas) {
    for (const item of lista) {
      if (vistos.has(item.video_id)) continue;
      vistos.add(item.video_id);
      out.push(item);
      if (out.length >= 15) return out;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    validarHorario();
    const { numero_mesa, token, q } = await req.json();
    const numeroMesa = Number(numero_mesa);
    const mesa = await validarMesaToken(numeroMesa, String(token));

    const termino = normalizarTerminoBusqueda(String(q), "musica");
    const limpio = termino.trim();
    if (limpio.length < 3) {
      return jsonResponse({ resultados: [], total: 0, cache: "skip", fuente: "skip" });
    }

    // 1) Caché exacta (0 cuota) — lo más barato.
    const enCache = await leerCacheYoutube(termino);
    if (enCache?.length) {
      return jsonResponse({
        resultados: enCache,
        total: enCache.length,
        cache: "hit",
        fuente: "cache",
      });
    }

    // 2) Catálogo del local (0 cuota).
    const deCatalogo = buscarEnCatalogo(termino);
    // 3) Caché aproximada (0 cuota).
    const aprox = (await buscarCacheAproximado(termino)) ?? [];

    const locales = mergeUnicos(deCatalogo, aprox);
    if (locales.length >= 5) {
      return jsonResponse({
        resultados: locales,
        total: locales.length,
        cache: "hit",
        fuente: deCatalogo.length ? "catalogo" : "cache_aprox",
      });
    }

    // 4) ¿Queda cuota y la mesa no está en cooldown?
    const cuota = await cuotaDisponible();
    const mesaOk = await mesaPuedeLlamarApi(mesa.id);
    if (!cuota.ok || !mesaOk) {
      if (locales.length > 0) {
        return jsonResponse({
          resultados: locales,
          total: locales.length,
          cache: "hit",
          fuente: "ahorro",
          aviso: cuota.ok
            ? "Espera unos segundos para buscar de nuevo en YouTube."
            : "Cupo de búsquedas nuevas de hoy al límite; mostrando éxitos guardados.",
        });
      }
      return errorResponse(
        "cuota_youtube",
        cuota.ok
          ? "Espera unos segundos antes de buscar otra canción nueva."
          : "Se agotó el cupo de búsquedas nuevas de hoy. Prueba un éxito del local o vuelve mañana.",
        429,
      );
    }

    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      if (locales.length > 0) {
        return jsonResponse({
          resultados: locales,
          total: locales.length,
          cache: "hit",
          fuente: "catalogo",
        });
      }
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
      if (locales.length > 0) {
        return jsonResponse({
          resultados: locales,
          total: locales.length,
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

    const resultados = await filtrarReproducibles(candidatos, apiKey);
    const finales = mergeUnicos(resultados, locales);

    if (resultados.length > 0) {
      await guardarCacheYoutube(termino, resultados);
    }

    return jsonResponse({
      resultados: finales,
      total: finales.length,
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
