import { createServiceClient } from "./supabase.ts";
import type { VideoCacheItem } from "./youtube_cache.ts";

const REGION = Deno.env.get("YOUTUBE_REGION") ?? "PE";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** IDs que ya fallaron en el reproductor / verificación. */
export async function obtenerBloqueados(ids: string[]): Promise<Set<string>> {
  const limpios = [...new Set(ids.map((id) => id.trim()).filter((id) => id.length >= 6))];
  if (limpios.length === 0) return new Set();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("youtube_bloqueados")
    .select("video_id")
    .in("video_id", limpios);
  return new Set((data ?? []).map((r) => r.video_id as string));
}

export async function marcarVideoBloqueado(
  videoId: string,
  motivo = "embed_bloqueado",
): Promise<void> {
  const id = videoId.trim();
  if (id.length < 6) return;
  const supabase = createServiceClient();
  await supabase.from("youtube_bloqueados").upsert({
    video_id: id,
    motivo: motivo.slice(0, 200),
    creado_en: new Date().toISOString(),
  });
}

/**
 * Consulta Data API: embeddable + región.
 * No detecta bloqueos de editoriales (LatinAutor) en sitios terceros.
 */
export async function filtrarPorDataApi(
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
    if (!res.ok) return candidatos; // no tirar todo si la API falla
    const data = await res.json();
    const ok = new Set<string>();

    for (const v of data.items ?? []) {
      const id = v.id as string;
      const status = v.status as { embeddable?: boolean; privacyStatus?: string } | undefined;
      const region = (
        v.contentDetails as {
          regionRestriction?: { blocked?: string[]; allowed?: string[] };
        } | undefined
      )?.regionRestriction;

      const embebible = status?.embeddable !== false;
      const publico =
        status?.privacyStatus === "public" ||
        status?.privacyStatus === "unlisted" ||
        status?.privacyStatus === undefined;
      const bloqueadoAqui = region?.blocked?.includes(REGION) ?? false;
      const permitidoAqui = region?.allowed ? region.allowed.includes(REGION) : true;

      if (embebible && publico && !bloqueadoAqui && permitidoAqui) ok.add(id);
    }

    return candidatos.filter((c) => ok.has(c.video_id));
  } catch {
    return candidatos;
  }
}

/**
 * Verifica abriendo la página /embed/.
 * Solo señales claramente textuales (LatinAutor u "embedding disabled").
 * No usar subcadenas cortas tipo "UMPG" (hay falsos positivos en el HTML).
 */
function htmlPareceBloqueado(html: string): boolean {
  if (!html || html.length < 80) return true;
  if (/playabilityStatus"\s*:\s*\{\s*"status"\s*:\s*"UNPLAYABLE"/i.test(html)) return true;
  if (/errorcode["\s:=]+["']?15[01]/i.test(html)) return true;
  if (/errorCode["\s:=]+["']?15[01]/i.test(html)) return true;
  if (/Playback on other websites has been disabled/i.test(html)) return true;
  if (/embedding disabled by request/i.test(html)) return true;
  if (/lo ha bloqueado para que no se muestre/i.test(html)) return true;
  if (/blocked it from display on this website/i.test(html)) return true;
  if (/LatinAutor\s*-\s*UMPG/i.test(html)) return true;
  if (/contenido de LatinAutor/i.test(html)) return true;
  if (/Este vídeo no está disponible/i.test(html) && /LatinAutor|no se muestre en este sitio/i.test(html)) {
    return true;
  }
  return false;
}

/**
 * Verificación server-side débil (muchos LatinAutor no aparecen en el HTML).
 * El filtro fuerte es el preflight del navegador del cliente.
 */
export async function embedPermiteReproducir(videoId: string): Promise<boolean> {
  const id = videoId.trim();
  if (id.length < 6) return false;

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(`https://www.youtube.com/embed/${id}?hl=es&rel=0`, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(to);

    if (!res.ok) return true; // no castigar por red
    const html = await res.text();
    return !htmlPareceBloqueado(html);
  } catch {
    return true;
  }
}

export async function filtrarPorEmbedReal(
  candidatos: VideoCacheItem[],
): Promise<VideoCacheItem[]> {
  if (candidatos.length === 0) return [];
  const checks = await Promise.all(
    candidatos.map(async (c) => ({
      c,
      ok: await embedPermiteReproducir(c.video_id),
    })),
  );
  return checks.filter((x) => x.ok).map((x) => x.c);
}

/**
 * Pipeline completo: blacklist BD → Data API (si hay key) → embed real.
 * Marca `embed_ok: true` en los que pasan.
 */
export async function filtrarReproduciblesCompleto(
  candidatos: VideoCacheItem[],
  apiKey?: string | null,
): Promise<VideoCacheItem[]> {
  if (candidatos.length === 0) return [];

  const bloqueados = await obtenerBloqueados(candidatos.map((c) => c.video_id));
  let lista = candidatos.filter((c) => !bloqueados.has(c.video_id));
  if (lista.length === 0) return [];

  if (apiKey) {
    lista = await filtrarPorDataApi(lista, apiKey);
    if (lista.length === 0) return [];
  }

  // Los ya verificados en caché se saltan el scrape (más rápido).
  const pendientes = lista.filter((c) => !c.embed_ok);
  const yaOk = lista.filter((c) => c.embed_ok);
  const verificados = await filtrarPorEmbedReal(pendientes);

  // Los que fallaron el embed → aprender para próximas búsquedas
  const okIds = new Set(verificados.map((v) => v.video_id));
  await Promise.all(
    pendientes
      .filter((c) => !okIds.has(c.video_id))
      .map((c) => marcarVideoBloqueado(c.video_id, "embed_check_buscar")),
  );

  return [...yaOk, ...verificados].map((c) => ({ ...c, embed_ok: true }));
}

/** Una sola canción (al encolar): check estricto. */
export async function videoEsReproducible(
  videoId: string,
  apiKey?: string | null,
): Promise<{ ok: boolean; motivo?: string }> {
  const id = videoId.trim();
  if (id.length < 6) return { ok: false, motivo: "id_invalido" };

  const bloqueados = await obtenerBloqueados([id]);
  if (bloqueados.has(id)) return { ok: false, motivo: "ya_bloqueado" };

  if (apiKey) {
    const fake: VideoCacheItem = {
      video_id: id,
      titulo: "",
      miniatura_url: "",
      canal: null,
    };
    const porApi = await filtrarPorDataApi([fake], apiKey);
    if (porApi.length === 0) {
      await marcarVideoBloqueado(id, "data_api_no_embed");
      return { ok: false, motivo: "no_embebible_api" };
    }
  }

  const embedOk = await embedPermiteReproducir(id);
  if (!embedOk) {
    await marcarVideoBloqueado(id, "embed_check_encolar");
    return { ok: false, motivo: "bloqueado_embed" };
  }

  return { ok: true };
}
