import {
  buscarCacheAproximado,
  guardarCacheYoutube,
  leerCacheYoutube,
  normalizarTerminoBusqueda,
  type VideoCacheItem,
} from "./youtube_cache.ts";
import {
  cuotaDisponible,
  registrarBusquedaApi,
} from "./youtube_cuota.ts";
import { filtrarReproduciblesCompleto } from "./youtube_embed.ts";

function scorePreferencia(titulo: string): number {
  const t = titulo.toLowerCase();
  let s = 0;
  if (/\bkaraoke\b/.test(t)) s += 2;
  if (/\b(letra|lyrics|pista)\b/.test(t)) s += 1;
  if (/\bsing[- ]?along\b/.test(t)) s += 1;
  return s;
}

export function ordenarPreferenciaSuave(items: VideoCacheItem[]): VideoCacheItem[] {
  return [...items].sort(
    (a, b) => scorePreferencia(b.titulo) - scorePreferencia(a.titulo),
  );
}

export type BusquedaYoutubeResult = {
  resultados: VideoCacheItem[];
  total: number;
  cache: string;
  fuente: string;
  aviso?: string;
  cuota?: { usadas: number; max: number };
};

/**
 * Búsqueda compartida (mesa o admin).
 * `marcarMesaApi` solo para cuota por mesa de clientes.
 */
export async function ejecutarBusquedaYoutube(opts: {
  q: string;
  mesaId?: number;
  /** Admin: no se bloquea por el cupo diario de la app (sigue contando uso). */
  esAdmin?: boolean;
  marcarMesaApi?: (mesaId: number) => Promise<void>;
}): Promise<BusquedaYoutubeResult> {
  const termino = normalizarTerminoBusqueda(String(opts.q), "musica");
  const limpio = termino.trim();
  if (limpio.length < 2) {
    return { resultados: [], total: 0, cache: "skip", fuente: "skip" };
  }

  const apiKey = Deno.env.get("YOUTUBE_API_KEY") ?? null;

  const enCache = await leerCacheYoutube(termino);
  if (enCache?.length) {
    const resultados = ordenarPreferenciaSuave(
      await filtrarReproduciblesCompleto(enCache, apiKey),
    );
    if (resultados.length > 0) await guardarCacheYoutube(termino, resultados);
    return { resultados, total: resultados.length, cache: "hit", fuente: "cache" };
  }

  const aprox = (await buscarCacheAproximado(termino)) ?? [];
  if (aprox.length >= 5) {
    const resultados = ordenarPreferenciaSuave(
      await filtrarReproduciblesCompleto(aprox, apiKey),
    );
    if (resultados.length >= 3) {
      return { resultados, total: resultados.length, cache: "hit", fuente: "cache_aprox" };
    }
  }

  const cuota = await cuotaDisponible();
  if (!cuota.ok && !opts.esAdmin) {
    if (aprox.length > 0) {
      const resultados = ordenarPreferenciaSuave(
        await filtrarReproduciblesCompleto(aprox, apiKey),
      );
      return {
        resultados,
        total: resultados.length,
        cache: "hit",
        fuente: "ahorro",
        aviso: "Cupo de búsquedas de hoy al límite; mostrando resultados guardados.",
      };
    }
    throw new Error("cuota_youtube");
  }

  if (!apiKey) throw new Error("youtube_no_configurado");

  const params = new URLSearchParams({
    part: "snippet",
    q: termino,
    type: "video",
    maxResults: "20",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "moderate",
    key: apiKey,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    if (aprox.length > 0) {
      const resultados = ordenarPreferenciaSuave(
        await filtrarReproduciblesCompleto(aprox, apiKey),
      );
      return {
        resultados,
        total: resultados.length,
        cache: "hit",
        fuente: "ahorro",
        aviso: "YouTube no respondió; mostrando sugerencias guardadas.",
      };
    }
    throw new Error("youtube_error");
  }

  await registrarBusquedaApi();
  if (opts.mesaId != null && opts.marcarMesaApi) {
    await opts.marcarMesaApi(opts.mesaId);
  }

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
    await filtrarReproduciblesCompleto(candidatos, apiKey),
  );
  if (resultados.length > 0) await guardarCacheYoutube(termino, resultados);

  return {
    resultados,
    total: resultados.length,
    cache: "miss",
    fuente: "youtube",
    cuota: { usadas: cuota.usadas + 1, max: cuota.max },
  };
}
