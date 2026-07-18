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
import { filtrarReproduciblesCompleto } from "../_shared/youtube_embed.ts";
import { exigirCooldownMesa } from "../_shared/mesa_rate.ts";
import {
  fetchYoutubeConRotacion,
  pickYoutubeApiKey,
  youtubeKeysCount,
} from "../_shared/youtube_keys.ts";

/**
 * Preferencia suave (no filtra): karaoke/letra un poco arriba.
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
    if (limpio.length < 2) {
      return jsonResponse({ resultados: [], total: 0, cache: "skip", fuente: "skip" });
    }
    if (limpio.length > 80) {
      return errorResponse("busqueda_muy_larga", "La búsqueda es demasiado larga.", 400);
    }

    // Todas las rutas (caché o API) cuentan: evita spam de embed checks.
    try {
      await exigirCooldownMesa(mesa.id, "buscar_youtube", 3);
    } catch (e) {
      if (e instanceof Error && e.message === "rate_limit") {
        return jsonResponse({
          resultados: [],
          total: 0,
          cache: "miss",
          fuente: "cooldown",
          aviso: "Espera un momento y vuelve a buscar.",
        });
      }
      throw e;
    }

    const apiKey = pickYoutubeApiKey();

    const enCache = await leerCacheYoutube(termino);
    if (enCache?.length) {
      const resultados = ordenarPreferenciaSuave(
        await filtrarReproduciblesCompleto(enCache, apiKey),
      );
      // Si el filtro dejó casi nada, no servir caché podrida: ir a YouTube.
      if (resultados.length >= 3 || (resultados.length > 0 && resultados.length >= Math.ceil(enCache.length * 0.35))) {
        await guardarCacheYoutube(termino, resultados);
        return jsonResponse({
          resultados,
          total: resultados.length,
          cache: "hit",
          fuente: "cache",
        });
      }
    }

    const aprox = (await buscarCacheAproximado(termino)) ?? [];
    if (aprox.length >= 5) {
      const resultados = ordenarPreferenciaSuave(
        await filtrarReproduciblesCompleto(aprox, apiKey),
      );
      if (resultados.length >= 3) {
        return jsonResponse({
          resultados,
          total: resultados.length,
          cache: "hit",
          fuente: "cache_aprox",
        });
      }
      // Si casi todo estaba bloqueado, sigue a YouTube.
    }

    const cuota = await cuotaDisponible();
    const mesaOk = await mesaPuedeLlamarApi(mesa.id);
    if (!cuota.ok || !mesaOk) {
      if (aprox.length > 0) {
        const resultados = ordenarPreferenciaSuave(
          await filtrarReproduciblesCompleto(aprox, apiKey),
        );
        if (resultados.length > 0) {
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
      }
      // Cooldown de mesa: no devolver error rojo; el cliente reintentará al terminar de escribir.
      if (cuota.ok && !mesaOk) {
        return jsonResponse({
          resultados: [],
          total: 0,
          cache: "miss",
          fuente: "cooldown",
          aviso: "Espera un momento y vuelve a buscar.",
        });
      }
      return errorResponse(
        "cuota_youtube",
        "Se agotó el cupo de búsquedas nuevas de hoy.",
        429,
      );
    }

    if (youtubeKeysCount() === 0) {
      return errorResponse("youtube_no_configurado", "La búsqueda estará disponible pronto.", 503);
    }

    const res = await fetchYoutubeConRotacion((key) => {
      const params = new URLSearchParams({
        part: "snippet",
        q: termino,
        type: "video",
        maxResults: "20",
        videoEmbeddable: "true",
        videoSyndicated: "true",
        safeSearch: "moderate",
        key,
      });
      return `https://www.googleapis.com/youtube/v3/search?${params}`;
    });

    if (!res.ok) {
      if (aprox.length > 0) {
        const resultados = ordenarPreferenciaSuave(
          await filtrarReproduciblesCompleto(aprox, apiKey),
        );
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
          titulo: String(item.snippet.title ?? "Sin título"),
          miniatura_url: thumbs?.medium?.url ?? thumbs?.default?.url ?? "",
          canal: (item.snippet.channelTitle as string | undefined) ?? null,
        };
      });

    const resultados = ordenarPreferenciaSuave(
      await filtrarReproduciblesCompleto(candidatos, pickYoutubeApiKey()),
    );

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
