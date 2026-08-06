/** Rutas de retorno del flujo cliente (mesa) — no deben caer en /admin. */

const KEY_VOLVER = "dc-volver-a";
const KEY_MODO = "dc-modo-cliente";

export function marcarModoCliente(rutaMesa: string): void {
  try {
    sessionStorage.setItem(KEY_MODO, "1");
    sessionStorage.setItem(KEY_VOLVER, rutaMesa);
  } catch {
    /* ignore */
  }
}

export function guardarRutaVolver(ruta: string): void {
  try {
    if (ruta && ruta !== "/privacidad") {
      sessionStorage.setItem(KEY_VOLVER, ruta);
    }
  } catch {
    /* ignore */
  }
}

export function leerRutaVolver(): string | null {
  try {
    return sessionStorage.getItem(KEY_VOLVER);
  } catch {
    return null;
  }
}

export function enModoCliente(): boolean {
  try {
    return sessionStorage.getItem(KEY_MODO) === "1";
  } catch {
    return false;
  }
}

export function limpiarModoCliente(): void {
  try {
    sessionStorage.removeItem(KEY_MODO);
    sessionStorage.removeItem(KEY_VOLVER);
  } catch {
    /* ignore */
  }
}
