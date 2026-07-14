import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type Perfil } from "../supabase/client";

const BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type AuthState = {
  user: User | null;
  session: Session | null;
  perfil: Perfil | null;
  esAdmin: boolean;
  cargando: boolean;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [esAdmin, setEsAdmin] = useState(false);
  const [cargando, setCargando] = useState(true);

  const verificarAdmin = useCallback(async (accessToken: string) => {
    try {
      const res = await fetch(`${BASE}/functions/v1/verificar-admin`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: ANON,
        },
      });
      const data = await res.json();
      return Boolean(data.es_admin);
    } catch {
      return false;
    }
  }, []);

  const cargarPerfil = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("perfiles")
      .select("id, email, nombre, avatar_url, rol")
      .eq("id", userId)
      .maybeSingle();
    if (data) setPerfil(data as Perfil);
    return data as Perfil | null;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await cargarPerfil(s.user.id);
        const admin = await verificarAdmin(s.access_token);
        setEsAdmin(admin);
      }
      setCargando(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await cargarPerfil(s.user.id);
        const admin = await verificarAdmin(s.access_token);
        setEsAdmin(admin);
      } else {
        setPerfil(null);
        setEsAdmin(false);
      }
      setCargando(false);
    });

    return () => subscription.unsubscribe();
  }, [cargarPerfil, verificarAdmin]);

  const loginGoogle = useCallback(async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo ?? window.location.href,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
    setEsAdmin(false);
  }, []);

  const accessToken = session?.access_token ?? "";

  return {
    user,
    session,
    perfil,
    esAdmin,
    cargando,
    accessToken,
    loginGoogle,
    logout,
    nombreMostrar: perfil?.nombre ?? user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "",
  };
}
