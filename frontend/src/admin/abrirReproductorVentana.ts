/** Pestaña nombrada del reproductor (TV / segunda pantalla). */

export const REPRODUCTOR_WINDOW_NAME = "dc-reproductor";
export const REPRODUCTOR_PATH = "/admin/pantalla";

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

/**
 * Abre el reproductor en otra pestaña.
 * Si ya está abierta, solo la enfoca (sin recargar → la música no se reinicia).
 */
export function abrirReproductorVentana(): Window | null {
  const url = `${window.location.origin}${REPRODUCTOR_PATH}`;

  try {
    if (reproWin && !reproWin.closed) {
      reproWin.focus();
      return reproWin;
    }
  } catch {
    reproWin = null;
  }

  // Importante: abrir con nombre vacío primero.
  // Si la pestaña ya existe, el navegador la devuelve SIN recargar.
  // Pasar la URL cada vez (window.open(url, name)) sí recarga y reinicia el video.
  const win = window.open("", REPRODUCTOR_WINDOW_NAME);
  if (!win) return null;

  reproWin = win;

  try {
    if (!mismaPantalla(win)) {
      win.location.href = url;
    }
    win.focus();
  } catch {
    try {
      win.location.href = url;
      win.focus();
    } catch {
      /* bloqueado */
    }
  }

  return win;
}
