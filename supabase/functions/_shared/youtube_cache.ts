import { createServiceClient } from "./supabase.ts";

export type VideoCacheItem = {
  video_id: string;
  titulo: string;
  miniatura_url: string;
  canal: string | null;
  /** Ya pasó verificación de embed (scraping / encolar). */
  embed_ok?: boolean;
};

/** Tope YouTube API ToS: no retener datos de la API más de 30 días. */
const TTL_DIAS = 30;

export type ModoBusqueda = "musica" | "karaoke";

/** Normaliza el término. En karaoke añade la palabra si no viene. */
export function normalizarTerminoBusqueda(q: string, modo: ModoBusqueda = "karaoke"): string {
  let t = q.trim().toLowerCase().replace(/\s+/g, " ");
  if (modo === "karaoke" && t.length >= 2 && !/\bkaraoke\b/i.test(t)) {
    t = `${t} karaoke`;
  }
  return t;
}

function diasDesde(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/** Lee caché exacta. Si expiró o supera 30 días desde la obtención, se borra. */
export async function leerCacheYoutube(termino: string): Promise<VideoCacheItem[] | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("youtube_cache")
    .select("resultados, expira_en, creado_en, aciertos")
    .eq("termino", termino)
    .maybeSingle();

  if (error || !data) return null;

  const ahora = new Date();
  const expira = new Date(data.expira_en);
  const creado = new Date(data.creado_en as string);
  const limiteMax = diasDesde(creado, TTL_DIAS);

  // Cumplir retención ≤30 días: no servir stale ni alargar sin reconsultar YouTube.
  if (expira <= ahora || ahora >= limiteMax) {
    await supabase.from("youtube_cache").delete().eq("termino", termino);
    return null;
  }

  await supabase
    .from("youtube_cache")
    .update({
      aciertos: (data.aciertos as number | null ?? 0) + 1,
    })
    .eq("termino", termino);

  return data.resultados as VideoCacheItem[];
}

/**
 * Coincidencia aproximada en caché (misma noche, typos leves / subcadena).
 * No llama a YouTube.
 */
export async function buscarCacheAproximado(
  termino: string,
  limite = 12,
): Promise<VideoCacheItem[] | null> {
  const supabase = createServiceClient();
  const q = termino.replace(/%/g, "").replace(/_/g, "");
  if (q.length < 3) return null;

  const ahoraIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("youtube_cache")
    .select("termino, resultados, aciertos, expira_en, creado_en")
    .or(`termino.ilike.%${q}%,termino.eq.${q}`)
    .gt("expira_en", ahoraIso)
    .order("aciertos", { ascending: false })
    .limit(8);

  if (error || !data?.length) return null;

  const ahora = new Date();
  const vistos = new Set<string>();
  const out: VideoCacheItem[] = [];
  for (const fila of data) {
    const creado = new Date(fila.creado_en as string);
    if (ahora >= diasDesde(creado, TTL_DIAS)) continue;
    const items = fila.resultados as VideoCacheItem[];
    for (const item of items) {
      if (vistos.has(item.video_id)) continue;
      vistos.add(item.video_id);
      out.push(item);
      if (out.length >= limite) return out;
    }
  }
  return out.length > 0 ? out : null;
}

export async function guardarCacheYoutube(termino: string, resultados: VideoCacheItem[]): Promise<void> {
  const supabase = createServiceClient();
  const ahora = new Date();
  await supabase.from("youtube_cache").upsert({
    termino,
    resultados,
    expira_en: diasDesde(ahora, TTL_DIAS).toISOString(),
    creado_en: ahora.toISOString(),
  });
}
