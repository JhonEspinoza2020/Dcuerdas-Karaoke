import { createServiceClient } from "./supabase.ts";

/**
 * Tope de search.list por día (Lima) a nivel app.
 *
 * - Sin secret → 100 (1 proyecto, cuota estándar).
 * - Con YOUTUBE_MAX_BUSQUEDAS_DIA → ese valor (ej. 1000 si Google aprueba más cuota).
 *
 * Hoy deja el secret en 100. Cuando aprueben el trámite, cámbialo a 1000 (o lo que den).
 */
export function maxBusquedasDia(): number {
  const raw = (Deno.env.get("YOUTUBE_MAX_BUSQUEDAS_DIA") ?? "").trim();
  if (raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return 100;
}

/**
 * Soft-limit por key: al llegar aquí dejamos de usar esa key y rotamos.
 * Google suele cortar cerca de 100 search.list; 99 evita el 403.
 */
export function softLimitPorKey(): number {
  const n = Number(Deno.env.get("YOUTUBE_SOFT_LIMIT_POR_KEY") ?? "99");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 99;
}

/** Segundos mínimos entre dos search.list de la misma mesa. */
export function cooldownMesaSeg(): number {
  const n = Number(Deno.env.get("YOUTUBE_COOLDOWN_MESA_SEG") ?? "12");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 12;
}

function diaLima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

/** Fingerprint estable de la API key (no guardamos la key completa). */
export function fingerprintApiKey(apiKey: string): string {
  let h = 2166136261;
  for (let i = 0; i < apiKey.length; i++) {
    h ^= apiKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `k${(h >>> 0).toString(16)}`;
}

export async function leerUsosPorClave(): Promise<Record<string, number>> {
  const supabase = createServiceClient();
  const dia = diaLima();
  const { data } = await supabase
    .from("youtube_cuota_dia")
    .select("por_clave")
    .eq("dia", dia)
    .maybeSingle();
  const raw = data?.por_clave;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
  }
  return out;
}

export async function cuotaDisponible(): Promise<{ ok: boolean; usadas: number; max: number }> {
  const max = maxBusquedasDia();
  const supabase = createServiceClient();
  const dia = diaLima();
  const { data } = await supabase
    .from("youtube_cuota_dia")
    .select("busquedas_api")
    .eq("dia", dia)
    .maybeSingle();
  const usadas = data?.busquedas_api ?? 0;
  return { ok: usadas < max, usadas, max };
}

/**
 * Suma 1 al total del día y, si hay fingerprint, a esa API key.
 * Si `forzarUsos` se pasa, fija el contador de esa key (p. ej. marcar agotada).
 */
export async function registrarBusquedaApi(
  keyFingerprint?: string | null,
  opts?: { forzarUsosClave?: number },
): Promise<void> {
  const supabase = createServiceClient();
  const dia = diaLima();
  const { data } = await supabase
    .from("youtube_cuota_dia")
    .select("busquedas_api, por_clave")
    .eq("dia", dia)
    .maybeSingle();

  const usadas = (data?.busquedas_api ?? 0) + (opts?.forzarUsosClave != null ? 0 : 1);
  const porClave: Record<string, number> = {};
  const prev = data?.por_clave;
  if (prev && typeof prev === "object" && !Array.isArray(prev)) {
    for (const [k, v] of Object.entries(prev as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) porClave[k] = Math.floor(n);
    }
  }

  if (keyFingerprint) {
    if (opts?.forzarUsosClave != null) {
      porClave[keyFingerprint] = Math.max(
        porClave[keyFingerprint] ?? 0,
        Math.floor(opts.forzarUsosClave),
      );
    } else {
      porClave[keyFingerprint] = (porClave[keyFingerprint] ?? 0) + 1;
    }
  }

  await supabase.from("youtube_cuota_dia").upsert({
    dia,
    busquedas_api: opts?.forzarUsosClave != null ? (data?.busquedas_api ?? 0) : usadas,
    por_clave: porClave,
    actualizado_en: new Date().toISOString(),
  });
}

/** Marca una key como agotada (soft) para no volver a usarla hoy. */
export async function marcarClaveAgotada(apiKey: string): Promise<void> {
  const fp = fingerprintApiKey(apiKey);
  await registrarBusquedaApi(fp, { forzarUsosClave: softLimitPorKey() });
}

/** true = esta mesa puede gastar API ahora. */
export async function mesaPuedeLlamarApi(mesaId: number): Promise<boolean> {
  const wait = cooldownMesaSeg();
  if (wait <= 0) return true;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("youtube_rate_mesa")
    .select("ultima_api_en")
    .eq("mesa_id", mesaId)
    .maybeSingle();
  if (!data?.ultima_api_en) return true;
  const elapsed = Date.now() - new Date(data.ultima_api_en).getTime();
  return elapsed >= wait * 1000;
}

export async function marcarApiMesa(mesaId: number): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("youtube_rate_mesa").upsert({
    mesa_id: mesaId,
    ultima_api_en: new Date().toISOString(),
  });
}
