import { createServiceClient } from "./supabase.ts";

/**
 * Tope de search.list por día (Lima) a nivel app.
 *
 * Hoy: 100 si no hay flag. Con Google a 50.000 unidades de search (~500 búsquedas):
 *   YOUTUBE_CUOTA_AMPLIADA=true
 *   YOUTUBE_MAX_BUSQUEDAS_DIA=500
 *   YOUTUBE_SOFT_LIMIT_POR_KEY=490
 * Sin el flag, un secret viejo en 1000 no engaña al panel.
 */
export function maxBusquedasDia(): number {
  const ampliada = Deno.env.get("YOUTUBE_CUOTA_AMPLIADA") === "true";
  const raw = (Deno.env.get("YOUTUBE_MAX_BUSQUEDAS_DIA") ?? "").trim();
  const parsed = raw !== "" ? Number(raw) : NaN;
  const desdeSecret = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;

  if (ampliada) {
    return Math.max(1, desdeSecret ?? 500);
  }
  return 100;
}

/**
 * Soft-limit por key: al llegar aquí dejamos de usar esa key y rotamos.
 * Default 99 (cuota Google 10k). Con cuota ampliada, sigue el tope diario
 * salvo que pongas YOUTUBE_SOFT_LIMIT_POR_KEY.
 */
export function softLimitPorKey(): number {
  const n = Number(Deno.env.get("YOUTUBE_SOFT_LIMIT_POR_KEY") ?? "");
  if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  if (Deno.env.get("YOUTUBE_CUOTA_AMPLIADA") === "true") {
    return Math.max(1, maxBusquedasDia() - 10);
  }
  return 99;
}

/** Segundos mínimos entre dos search.list de la misma mesa. */
export function cooldownMesaSeg(): number {
  const n = Number(Deno.env.get("YOUTUBE_COOLDOWN_MESA_SEG") ?? "12");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 12;
}

function diaLima(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

  if (opts?.forzarUsosClave != null && keyFingerprint) {
    const { data } = await supabase
      .from("youtube_cuota_dia")
      .select("busquedas_api, por_clave")
      .eq("dia", dia)
      .maybeSingle();

    const porClave: Record<string, number> = {};
    const prev = data?.por_clave;
    if (prev && typeof prev === "object" && !Array.isArray(prev)) {
      for (const [k, v] of Object.entries(prev as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) porClave[k] = Math.floor(n);
      }
    }
    porClave[keyFingerprint] = Math.max(
      porClave[keyFingerprint] ?? 0,
      Math.floor(opts.forzarUsosClave),
    );

    const { error } = await supabase.from("youtube_cuota_dia").upsert(
      {
        dia,
        busquedas_api: data?.busquedas_api ?? 0,
        por_clave: porClave,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "dia" },
    );
    if (error) {
      console.error("youtube_cuota_dia forzar upsert:", error.message);
      throw new Error("cuota_registro_fallido");
    }
    return;
  }

  const { data, error } = await supabase.rpc("increment_youtube_cuota_dia", {
    p_dia: dia,
    p_clave: keyFingerprint ?? null,
  });
  if (error) {
    console.error("increment_youtube_cuota_dia:", error.message);
    throw new Error("cuota_registro_fallido");
  }
  if (typeof data !== "number") {
    console.error("increment_youtube_cuota_dia: respuesta inesperada", data);
    throw new Error("cuota_registro_fallido");
  }
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
