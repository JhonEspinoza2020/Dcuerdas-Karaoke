/**
 * Rotación de API keys de YouTube.
 * Por defecto SOLO YOUTUBE_API_KEY (1 proyecto).
 * Multi-proyecto (YOUTUBE_API_KEYS) queda desactivado salvo
 * YOUTUBE_USE_MULTI_KEYS=true — Google sancionó el pool.
 *
 * Soft-limit por key (default 99): YOUTUBE_SOFT_LIMIT_POR_KEY
 */

import {
  fingerprintApiKey,
  leerUsosPorClave,
  marcarClaveAgotada,
  softLimitPorKey,
} from "./youtube_cuota.ts";

function parseKeys(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 20);
}

/** Keys únicas en orden. Multi solo si YOUTUBE_USE_MULTI_KEYS=true. */
export function listYoutubeApiKeys(): string[] {
  const allowMulti = Deno.env.get("YOUTUBE_USE_MULTI_KEYS") === "true";
  const multi = allowMulti ? parseKeys(Deno.env.get("YOUTUBE_API_KEYS")) : [];
  const single = parseKeys(Deno.env.get("YOUTUBE_API_KEY"));
  const seen = new Set<string>();
  const out: string[] = [];
  // Preferir la key principal primero.
  for (const k of [...single, ...multi]) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function youtubeKeysCount(): number {
  return listYoutubeApiKeys().length;
}

/** Round-robin estable por minuto (Lima). Preferir keys bajo soft-limit. */
export function pickYoutubeApiKey(usos?: Record<string, number>): string | null {
  const keys = listYoutubeApiKeys();
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0];

  const soft = softLimitPorKey();
  const vivas = usos
    ? keys.filter((k) => (usos[fingerprintApiKey(k)] ?? 0) < soft)
    : keys;
  const pool = vivas.length > 0 ? vivas : keys;
  const minuto = Math.floor(Date.now() / 60_000);
  return pool[minuto % pool.length];
}

function esErrorCuota(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  const t = body.toLowerCase();
  return (
    t.includes("quota") ||
    t.includes("dailylimitexceeded") ||
    t.includes("dailyLimitExceeded".toLowerCase()) ||
    t.includes("ratelimitexceeded") ||
    t.includes("rateLimitExceeded".toLowerCase()) ||
    t.includes("userratelimitexceeded") ||
    t.includes("userRateLimitExceeded".toLowerCase())
  );
}

export type YoutubeFetchResult = {
  response: Response;
  /** Fingerprint de la key que respondió OK; null si ninguna. */
  keyId: string | null;
};

/**
 * GET a YouTube rotando keys:
 * 1) Prioriza keys con usos &lt; soft-limit (99) — no espera al 403 de Google.
 * 2) Si una responde cuota, la marca agotada y prueba la siguiente.
 */
export async function fetchYoutubeConRotacion(
  buildUrl: (apiKey: string) => string,
): Promise<YoutubeFetchResult> {
  const keys = listYoutubeApiKeys();
  if (keys.length === 0) {
    throw new Error("youtube_no_configurado");
  }

  const soft = softLimitPorKey();
  const usos = await leerUsosPorClave();
  const vivas = keys.filter((k) => (usos[fingerprintApiKey(k)] ?? 0) < soft);
  const ordenBase = vivas.length > 0 ? vivas : keys;

  const start = Math.floor(Date.now() / 60_000) % ordenBase.length;
  let last: Response | null = null;

  for (let i = 0; i < ordenBase.length; i++) {
    const key = ordenBase[(start + i) % ordenBase.length];
    const res = await fetch(buildUrl(key));
    if (res.ok) {
      return { response: res, keyId: fingerprintApiKey(key) };
    }

    const body = await res.text();
    last = new Response(body, { status: res.status, headers: res.headers });

    if (esErrorCuota(res.status, body)) {
      await marcarClaveAgotada(key);
      continue;
    }
    return { response: last, keyId: null };
  }

  return { response: last ?? new Response("{}", { status: 502 }), keyId: null };
}
