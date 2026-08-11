import type { ColaItem } from "@dcuerdas/shared";

export const NOW_PLAYING_CHANNEL = "dc-now-playing";
export const NOW_PLAYING_STORAGE_KEY = "dc-now-playing-v1";
/** Si no hay heartbeat reciente, se considera el player cerrado/pausado. */
export const HEARTBEAT_MAX_AGE_MS = 2500;

export type NowPlayingPayload = {
  playing: boolean;
  youtube_video_id: string | null;
  titulo: string;
  nombre_cliente: string;
  numero_mesa: number | null;
  esAmbiente: boolean;
  /** Epoch ms — lo escribe el player en vivo. */
  ts?: number;
};

export function miniaturaYoutube(videoId: string | null | undefined): string {
  if (!videoId) return "";
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

export function payloadDesdeCola(
  item: ColaItem | null,
  opts?: { esAmbiente?: boolean; tituloAmbiente?: string; playing?: boolean },
): NowPlayingPayload {
  if (opts?.esAmbiente) {
    return {
      playing: opts.playing ?? true,
      youtube_video_id: item?.youtube_video_id ?? null,
      titulo: opts.tituloAmbiente || item?.titulo_cancion || "Ambiente",
      nombre_cliente: "",
      numero_mesa: null,
      esAmbiente: true,
    };
  }
  if (!item) {
    return {
      playing: false,
      youtube_video_id: null,
      titulo: "",
      nombre_cliente: "",
      numero_mesa: null,
      esAmbiente: false,
    };
  }
  return {
    playing: opts?.playing ?? item.estado === "reproduciendo",
    youtube_video_id: item.youtube_video_id,
    titulo: item.titulo_cancion,
    nombre_cliente: item.nombre_cliente,
    numero_mesa: item.numero_mesa,
    esAmbiente: false,
  };
}

function payloadQuieto(): NowPlayingPayload {
  return {
    playing: false,
    youtube_video_id: null,
    titulo: "",
    nombre_cliente: "",
    numero_mesa: null,
    esAmbiente: false,
    ts: Date.now(),
  };
}

/** Publica estado al panel (BroadcastChannel + localStorage heartbeat). */
export function publicarNowPlaying(payload: NowPlayingPayload): void {
  const full: NowPlayingPayload = { ...payload, ts: Date.now() };
  try {
    localStorage.setItem(NOW_PLAYING_STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* ignore */
  }
  try {
    const ch = new BroadcastChannel(NOW_PLAYING_CHANNEL);
    ch.postMessage(full);
    ch.close();
  } catch {
    /* Safari privado / sin soporte */
  }
}

export function leerNowPlayingAlmacenado(): NowPlayingPayload | null {
  try {
    const raw = localStorage.getItem(NOW_PLAYING_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as NowPlayingPayload;
    if (!data || typeof data !== "object") return null;
    return data;
  } catch {
    return null;
  }
}

/** playing real solo si el heartbeat del player está fresco. */
export function estaPlayingEnVivo(payload: NowPlayingPayload | null): boolean {
  if (!payload?.playing || !payload.youtube_video_id) return false;
  const ts = payload.ts ?? 0;
  return Date.now() - ts <= HEARTBEAT_MAX_AGE_MS;
}

/**
 * Hay tema cargado en la pestaña Reproductor (sonando o en pausa).
 * Sirve para el resumen: no borrar “Ahora suena” al pausar el video.
 */
export function hayTrackEnPlayer(payload: NowPlayingPayload | null): boolean {
  if (!payload?.youtube_video_id) return false;
  const ts = payload.ts ?? 0;
  return Date.now() - ts <= HEARTBEAT_MAX_AGE_MS;
}

/**
 * Suscribe a cambios en vivo. Llama onMsg con playing=false si el player
 * deja de emitir heartbeat (pestaña cerrada).
 */
export function suscribirNowPlaying(
  onMsg: (payload: NowPlayingPayload) => void,
): () => void {
  let last: NowPlayingPayload | null = leerNowPlayingAlmacenado();

  const emitir = (payload: NowPlayingPayload) => {
    last = payload;
    onMsg(payload);
  };

  const desdeStorage = () => {
    const stored = leerNowPlayingAlmacenado();
    if (!stored) {
      emitir(payloadQuieto());
      return;
    }
    if (!hayTrackEnPlayer(stored)) {
      emitir(payloadQuieto());
      return;
    }
    emitir(stored);
  };

  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(NOW_PLAYING_CHANNEL);
    ch.onmessage = (ev) => {
      if (ev.data && typeof ev.data === "object") {
        emitir(ev.data as NowPlayingPayload);
      }
    };
  } catch {
    ch = null;
  }

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === NOW_PLAYING_STORAGE_KEY) desdeStorage();
  };
  window.addEventListener("storage", onStorage);

  // Arranque + watchdog: si cierran la pestaña del player, limpiar (aunque estuviera en pausa).
  desdeStorage();
  const tick = window.setInterval(() => {
    if (!last?.youtube_video_id) return;
    if (!hayTrackEnPlayer(last)) {
      emitir(payloadQuieto());
    }
  }, 800);

  return () => {
    window.clearInterval(tick);
    window.removeEventListener("storage", onStorage);
    try {
      ch?.close();
    } catch {
      /* ignore */
    }
  };
}

/** Heartbeat periódico mientras el player está abierto (aunque esté en pausa). */
export function iniciarHeartbeatNowPlaying(
  getPayload: () => NowPlayingPayload,
): () => void {
  const beat = () => publicarNowPlaying(getPayload());
  beat();
  const id = window.setInterval(beat, 1000);
  const stop = () => {
    window.clearInterval(id);
    publicarNowPlaying({ ...getPayload(), playing: false, ts: Date.now() });
  };
  window.addEventListener("pagehide", stop);
  window.addEventListener("beforeunload", stop);
  return () => {
    window.clearInterval(id);
    window.removeEventListener("pagehide", stop);
    window.removeEventListener("beforeunload", stop);
    publicarNowPlaying({ ...getPayload(), playing: false, ts: Date.now() });
  };
}
