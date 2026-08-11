/** Posición del video solo para reanudar tras recarga de la pestaña del player. */

const KEY = "dc-repro-posicion";
const KEY_REANUDAR = "dc-repro-debe-reanudar";

export type PosicionRepro = {
  videoId: string;
  segundos: number;
  ts: number;
};

export function guardarPosicionRepro(videoId: string, segundos: number): void {
  if (!videoId || !Number.isFinite(segundos) || segundos < 2) return;
  try {
    const data: PosicionRepro = { videoId, segundos, ts: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Marcar que, si la pestaña se recarga, el próximo play puede reanudar. */
export function marcarReanudarTrasRecarga(): void {
  try {
    sessionStorage.setItem(KEY_REANUDAR, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Solo tras una recarga real. Consume el flag (una sola vez) y limpia la posición
 * para que el siguiente tema (cola o ambiente) no herede el seek.
 */
export function consumirPosicionTrasRecarga(videoId: string): number | null {
  try {
    if (sessionStorage.getItem(KEY_REANUDAR) !== "1") return null;
    sessionStorage.removeItem(KEY_REANUDAR);
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw || !videoId) return null;
    const data = JSON.parse(raw) as PosicionRepro;
    if (!data || data.videoId !== videoId) return null;
    if (Date.now() - data.ts > 120_000) return null;
    if (!Number.isFinite(data.segundos) || data.segundos < 2) return null;
    return data.segundos;
  } catch {
    return null;
  }
}

export function limpiarPosicionRepro(): void {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY_REANUDAR);
  } catch {
    /* ignore */
  }
}
