import { createServiceClient } from "./supabase.ts";

/** Lanza Error("rate_limit") si la mesa supera el tope en la ventana. */
export async function exigirRateLimitMesa(
  mesaId: number,
  accion: string,
  maxPorVentana: number,
  ventanaMs: number,
): Promise<void> {
  const supabase = createServiceClient();
  const desde = new Date(Date.now() - ventanaMs).toISOString();
  const { count, error } = await supabase
    .from("mesa_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("mesa_id", mesaId)
    .eq("accion", accion)
    .gte("creado_en", desde);
  if (error) throw error;
  if ((count ?? 0) >= maxPorVentana) throw new Error("rate_limit");
  const { error: insertError } = await supabase
    .from("mesa_rate_limits")
    .insert({ mesa_id: mesaId, accion });
  if (insertError) throw insertError;
}

/** Cooldown mínimo entre dos acciones (1 request por cooldownSeg). */
export async function exigirCooldownMesa(
  mesaId: number,
  accion: string,
  cooldownSeg: number,
): Promise<void> {
  if (cooldownSeg <= 0) return;
  await exigirRateLimitMesa(mesaId, accion, 1, cooldownSeg * 1000);
}

/** Rate limit admin reutilizando admin_rate_limits. */
export async function exigirRateLimitAdmin(
  actor: string,
  accion: string,
  maxPorMinuto: number,
): Promise<void> {
  const supabase = createServiceClient();
  const desde = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("admin_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("actor", actor)
    .eq("accion", accion)
    .gte("creado_en", desde);
  if (error) throw error;
  if ((count ?? 0) >= maxPorMinuto) throw new Error("rate_limit");
  const { error: insertError } = await supabase
    .from("admin_rate_limits")
    .insert({ actor, accion });
  if (insertError) throw insertError;
}
