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

export function guardarDatos(mesa: number, datos: ClienteDatos) {
  sessionStorage.setItem(`dc-datos-${mesa}`, JSON.stringify(datos));
}

export function cargarDatos(mesa: number): ClienteDatos | null {
  const raw = sessionStorage.getItem(`dc-datos-${mesa}`);
  return raw ? JSON.parse(raw) : null;
}

export function guardarPaso(mesa: number, paso: Paso) {
  sessionStorage.setItem(`dc-paso-${mesa}`, paso);
}

export function cargarPaso(mesa: number): Paso {
  return (sessionStorage.getItem(`dc-paso-${mesa}`) as Paso) ?? "registro";
}
