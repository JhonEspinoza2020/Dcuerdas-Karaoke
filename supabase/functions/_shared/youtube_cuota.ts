import { createServiceClient } from "./supabase.ts";
import { youtubeKeysCount } from "./youtube_keys.ts";

/**
 * Tope de search.list por día (Lima) a nivel app.
 * Por defecto: ~100 por cada API key configurada (mín. 90).
 * Override: secret YOUTUBE_MAX_BUSQUEDAS_DIA.
 */
export function maxBusquedasDia(): number {
  const auto = Math.max(90, youtubeKeysCount() * 100);
  const n = Number(Deno.env.get("YOUTUBE_MAX_BUSQUEDAS_DIA") ?? String(auto));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : auto;
}

/** Segundos mínimos entre dos search.list de la misma mesa. */
export function cooldownMesaSeg(): number {
  const n = Number(Deno.env.get("YOUTUBE_COOLDOWN_MESA_SEG") ?? "12");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 12;
}

function diaLima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
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

export async function registrarBusquedaApi(): Promise<void> {
  const supabase = createServiceClient();
  const dia = diaLima();
  const { data } = await supabase
    .from("youtube_cuota_dia")
    .select("busquedas_api")
    .eq("dia", dia)
    .maybeSingle();
  const usadas = (data?.busquedas_api ?? 0) + 1;
  await supabase.from("youtube_cuota_dia").upsert({
    dia,
    busquedas_api: usadas,
    actualizado_en: new Date().toISOString(),
  });
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
