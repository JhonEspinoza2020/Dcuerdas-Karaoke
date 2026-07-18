/** Configuración del anuncio de casa (panel admin → reproductor). */

export type AnuncioModo = "canciones" | "minutos";

export type AnuncioConfig = {
  activo: boolean;
  modo: AnuncioModo;
  /** Cada N canciones de cola (1–10). */
  cadaCanciones: number;
  /** Cada N minutos (1–15). */
  cadaMinutos: number;
};

export const ANUNCIO_CONFIG_KEY = "dc-anuncio-config";
export const ANUNCIO_PLAY_NOW_EVENT = "dc-anuncio-play-now";
export const ANUNCIO_CONFIG_EVENT = "dc-anuncio-config-changed";

export const ANUNCIO_DEFAULT: AnuncioConfig = {
  activo: true,
  modo: "canciones",
  cadaCanciones: 2,
  cadaMinutos: 10,
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function leerAnuncioConfig(): AnuncioConfig {
  try {
    const raw = window.localStorage.getItem(ANUNCIO_CONFIG_KEY);
    if (!raw) return { ...ANUNCIO_DEFAULT };
    const data = JSON.parse(raw) as Partial<AnuncioConfig>;
    return {
      activo: data.activo !== false,
      modo: data.modo === "minutos" ? "minutos" : "canciones",
      cadaCanciones: clamp(Number(data.cadaCanciones ?? 2), 1, 10),
      cadaMinutos: clamp(Number(data.cadaMinutos ?? 10), 1, 15),
    };
  } catch {
    return { ...ANUNCIO_DEFAULT };
  }
}

export function guardarAnuncioConfig(config: AnuncioConfig): AnuncioConfig {
  const limpia: AnuncioConfig = {
    activo: Boolean(config.activo),
    modo: config.modo === "minutos" ? "minutos" : "canciones",
    cadaCanciones: clamp(config.cadaCanciones, 1, 10),
    cadaMinutos: clamp(config.cadaMinutos, 1, 15),
  };
  try {
    window.localStorage.setItem(ANUNCIO_CONFIG_KEY, JSON.stringify(limpia));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(ANUNCIO_CONFIG_EVENT, { detail: limpia }));
  return limpia;
}

export function pedirAnuncioAhora(): void {
  window.dispatchEvent(new Event(ANUNCIO_PLAY_NOW_EVENT));
}
