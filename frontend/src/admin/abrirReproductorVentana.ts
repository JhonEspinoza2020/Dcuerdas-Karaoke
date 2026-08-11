/** Pestaña nombrada del reproductor (TV / segunda pantalla). */

export const REPRODUCTOR_WINDOW_NAME = "dc-reproductor";
export const REPRODUCTOR_PATH = "/admin/pantalla";
/** Timestamp: el admin acaba de pedir play (gesto de click). */
export const REPRO_AUDIO_UNLOCK_KEY = "dc-repro-audio-unlock";
export const REPRO_CMD_CHANNEL = "dc-repro-cmd";

let reproWin: Window | null = null;

function mismaPantalla(win: Window): boolean {
  try {
    return (
      win.location.origin === window.location.origin &&
      win.location.pathname.includes(REPRODUCTOR_PATH)
    );
  } catch {
    return false;
  }
}

function esAboutBlank(win: Window): boolean {
  try {
    const href = win.location.href;
    return href === "about:blank" || href === "";
  } catch {
    return false;
  }
}

function recordarYEnfocar(win: Window): Window {
  reproWin = win;
  try {
    win.focus();
  } catch {
    /* ignore */
  }
  return win;
}

/** Solo para arranque / pestaña nueva: pide play al reproductor. */
export function solicitarPlayReproductor(): void {
  try {
    localStorage.setItem(REPRO_AUDIO_UNLOCK_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  try {
    const ch = new BroadcastChannel(REPRO_CMD_CHANNEL);
    ch.postMessage({ type: "play", ts: Date.now() });
    ch.close();
  } catch {
    /* ignore */
  }
}

/**
 * Pestaña ya abierta: solo avisar “focus”.
 * El player NO debe reiniciar el video si ya está sonando.
 */
export function solicitarFocusReproductor(): void {
  try {
    const ch = new BroadcastChannel(REPRO_CMD_CHANNEL);
    ch.postMessage({ type: "focus", ts: Date.now() });
    ch.close();
  } catch {
    /* ignore */
  }
}

export function hayUnlockAudioReciente(maxAgeMs = 20_000): boolean {
  try {
    const ts = Number(localStorage.getItem(REPRO_AUDIO_UNLOCK_KEY) || 0);
    return !!ts && Date.now() - ts <= maxAgeMs;
  } catch {
    return false;
  }
}

export function consumirUnlockAudioReciente(maxAgeMs = 20_000): boolean {
  try {
    const ts = Number(localStorage.getItem(REPRO_AUDIO_UNLOCK_KEY) || 0);
    if (!ts || Date.now() - ts > maxAgeMs) return false;
    localStorage.removeItem(REPRO_AUDIO_UNLOCK_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Abre/navega con <a target> bajo el gesto del click (mejor autoplay con sonido). */
function navegarConGesto(url: string): Window | null {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = REPRODUCTOR_WINDOW_NAME;
    a.rel = "opener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    /* ignore */
  }
  try {
    const win = window.open("", REPRODUCTOR_WINDOW_NAME);
    if (win) return recordarYEnfocar(win);
  } catch {
    /* ignore */
  }
  try {
    const win = window.open(url, REPRODUCTOR_WINDOW_NAME, "noopener=no");
    if (win) return recordarYEnfocar(win);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Abre el reproductor en otra pestaña.
 * Si ya está abierta, solo la enfoca (sin reiniciar audio).
 * El click del círculo siempre deja flag de unlock para volumen.
 */
export function abrirReproductorVentana(): Window | null {
  const url = `${window.location.origin}${REPRODUCTOR_PATH}`;
  // Siempre marcar unlock (también al reenfocar): el player puede estar muteado.
  solicitarPlayReproductor();

  try {
    if (reproWin && !reproWin.closed && mismaPantalla(reproWin)) {
      solicitarFocusReproductor();
      return recordarYEnfocar(reproWin);
    }
  } catch {
    reproWin = null;
  }

  let win: Window | null = null;
  try {
    win = window.open("", REPRODUCTOR_WINDOW_NAME);
  } catch {
    return navegarConGesto(url);
  }
  if (!win) return null;

  if (mismaPantalla(win)) {
    solicitarFocusReproductor();
    return recordarYEnfocar(win);
  }

  if (esAboutBlank(win)) {
    try {
      win.close();
    } catch {
      /* ignore */
    }
    return navegarConGesto(url);
  }

  try {
    win.location.replace(url);
    return recordarYEnfocar(win);
  } catch {
    return navegarConGesto(url);
  }
}
