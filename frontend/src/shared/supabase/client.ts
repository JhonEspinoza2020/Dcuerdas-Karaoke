import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Tipos de tablas D'cuerdas */
export type CategoriaCarta = {
  id: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activa: boolean;
};

export type Plato = {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  imagen_url: string | null;
  disponible: boolean;
  destacado: boolean;
  orden: number;
};

export type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  avatar_url: string | null;
  rol: "cliente" | "admin" | "dueño";
};
