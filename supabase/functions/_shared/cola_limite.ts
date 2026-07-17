import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Canciones compartidas por mesa en la ventana. */
export const MAX_CANCIONES_MESA = 5;
/** Ventana rodante: al cumplirse 15 min desde la más antigua, libera 1 cupo. */
export const VENTANA_CANCIONES_MS = 15 * 60 * 1000;

export type LimiteColaResult = {
  max_mesa: number;
  ventana_minutos: number;
  usadas_mesa: number;
  restantes_mesa: number;
  espera_segundos: number;
  puede_encolar: boolean;
  motivo: "limite_mesa" | null;
  /** Alias compatibles con UI anterior. */
  max_persona: number;
  usadas_persona: number;
  restantes_persona: number;
  en_cola_mesa: number;
  max_en_cola_mesa: number;
};

export async function consultarLimiteCola(
  supabase: SupabaseClient,
  mesaId: number,
  _nombreCliente?: string,
): Promise<LimiteColaResult> {
  const ventanaMin = VENTANA_CANCIONES_MS / 60_000;
  const desde = new Date(Date.now() - VENTANA_CANCIONES_MS).toISOString();

  const { data: recientes, error } = await supabase
    .from("cola_reproduccion")
    .select("creado_en")
    .eq("mesa_id", mesaId)
    .gte("creado_en", desde)
    .order("creado_en", { ascending: true });

  if (error) throw error;

  const lista = recientes ?? [];
  const usadas = lista.length;
  const restantes = Math.max(0, MAX_CANCIONES_MESA - usadas);

  let esperaSeg = 0;
  let puede = true;
  let motivo: LimiteColaResult["motivo"] = null;

  if (usadas >= MAX_CANCIONES_MESA && lista.length > 0) {
    const masAntigua = new Date(String(lista[0].creado_en)).getTime();
    esperaSeg = Math.max(0, Math.ceil((masAntigua + VENTANA_CANCIONES_MS - Date.now()) / 1000));
    puede = false;
    motivo = "limite_mesa";
  }

  return {
    max_mesa: MAX_CANCIONES_MESA,
    ventana_minutos: ventanaMin,
    usadas_mesa: usadas,
    restantes_mesa: restantes,
    espera_segundos: esperaSeg,
    puede_encolar: puede,
    motivo,
    max_persona: MAX_CANCIONES_MESA,
    usadas_persona: usadas,
    restantes_persona: restantes,
    en_cola_mesa: usadas,
    max_en_cola_mesa: MAX_CANCIONES_MESA,
  };
}

export function mensajeLimiteCola(limite: LimiteColaResult): string {
  if (limite.motivo === "limite_mesa") {
    const mins = Math.max(1, Math.ceil(limite.espera_segundos / 60));
    return `Tu mesa ya pidió ${limite.max_mesa} canciones en ${limite.ventana_minutos} min. Espera ${mins} min para pedir otra.`;
  }
  return `Tu mesa alcanzó el límite de canciones.`;
}
