/**
 * Rotación de API keys de YouTube (un key por proyecto GCP).
 * Secrets:
 *   YOUTUBE_API_KEYS=key1,key2,key3
 *   YOUTUBE_API_KEY=key_legacy (opcional, fallback)
 */

function parseKeys(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 20);
}

/** Keys únicas en orden. */
export function listYoutubeApiKeys(): string[] {
  const multi = parseKeys(Deno.env.get("YOUTUBE_API_KEYS"));
  const single = parseKeys(Deno.env.get("YOUTUBE_API_KEY"));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of [...multi, ...single]) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function youtubeKeysCount(): number {
  return listYoutubeApiKeys().length;
}

/** Round-robin estable por minuto (Lima). */
export function pickYoutubeApiKey(): string | null {
  const keys = listYoutubeApiKeys();
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0];
  const minuto = Math.floor(Date.now() / 60_000);
  return keys[minuto % keys.length];
}

function esErrorCuota(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  const t = body.toLowerCase();
  return (
    t.includes("quota") ||
    t.includes("dailyLimitExceeded") ||
    t.includes("dailylimitexceeded") ||
    t.includes("rateLimitExceeded") ||
    t.includes("ratelimitexceeded") ||
    t.includes("userRateLimitExceeded")
  );
}

/**
 * GET a YouTube Data API rotando keys si una se quedó sin cuota.
 * `buildUrl` recibe la key a usar.
 */
export async function fetchYoutubeConRotacion(
  buildUrl: (apiKey: string) => string,
): Promise<Response> {
  const keys = listYoutubeApiKeys();
  if (keys.length === 0) {
    throw new Error("youtube_no_configurado");
  }

  const start = Math.floor(Date.now() / 60_000) % keys.length;
  let last: Response | null = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[(start + i) % keys.length];
    const res = await fetch(buildUrl(key));
    if (res.ok) return res;

    const body = await res.text();
    last = new Response(body, { status: res.status, headers: res.headers });

    if (esErrorCuota(res.status, body)) continue;
    return last;
  }

  return last ?? new Response("{}", { status: 502 });
}
