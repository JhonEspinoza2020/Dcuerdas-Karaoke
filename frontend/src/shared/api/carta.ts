import { supabase } from "../supabase/client";

export type Plato = {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  orden: number;
};

export type CategoriaCarta = {
  id: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  platos: Plato[];
};

export async function obtenerCarta(): Promise<CategoriaCarta[]> {
  const { data, error } = await supabase
    .from("categorias_carta")
    .select("id, nombre, descripcion, orden, platos(id, categoria_id, nombre, descripcion, precio, disponible, orden)")
    .eq("activa", true)
    .order("orden");

  if (error) throw error;

  return (data ?? []).map((cat: CategoriaCarta & { platos: Plato[] }) => ({
    ...cat,
    platos: ((cat.platos as Plato[]) ?? [])
      .filter((p) => p.disponible)
      .sort((a, b) => a.orden - b.orden),
  }));
}
