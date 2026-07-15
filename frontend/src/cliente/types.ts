export type ClienteDatos = {
  nombre: string;
  numPersonas: string;
  notaCocina: string;
  telefono: string;
};

export type Paso = "registro" | "carta" | "karaoke";

export type CarritoItem = {
  plato_id: number;
  plato_nombre: string;
  precio: number;
  cantidad: number;
};

const NOMBRE_GLOBAL = "dc-cliente-nombre";

function leerStorage(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function escribirLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
}

export function guardarDatos(mesa: number, datos: ClienteDatos) {
  escribirLocal(`dc-datos-${mesa}`, JSON.stringify(datos));
  const nombre = datos.nombre.trim();
  if (nombre) escribirLocal(NOMBRE_GLOBAL, nombre);
}

export function cargarDatos(mesa: number): ClienteDatos | null {
  const raw = leerStorage(`dc-datos-${mesa}`);
  if (raw) {
    try {
      const datos = JSON.parse(raw) as ClienteDatos;
      if (!datos.nombre?.trim()) {
        const global = leerStorage(NOMBRE_GLOBAL);
        if (global) datos.nombre = global;
      }
      return datos;
    } catch {
      /* fall through */
    }
  }
  const nombre = leerStorage(NOMBRE_GLOBAL);
  if (nombre) {
    return { nombre, numPersonas: "", notaCocina: "", telefono: "" };
  }
  return null;
}

export function guardarPaso(mesa: number, paso: Paso) {
  escribirLocal(`dc-paso-${mesa}`, paso);
}

export function cargarPaso(mesa: number): Paso {
  return (leerStorage(`dc-paso-${mesa}`) as Paso) ?? "registro";
}
