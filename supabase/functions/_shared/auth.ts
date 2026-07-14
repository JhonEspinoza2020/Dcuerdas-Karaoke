import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createServiceClient } from "./supabase.ts";

export type AdminAuth = {
  email: string;
  userId: string;
  rol: string;
  metodo: "jwt" | "api_key";
};

function emailsAdminEnv(): string[] {
  return (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function esEmailAdmin(email: string): Promise<{ ok: boolean; rol: string }> {
  const normalizado = email.trim().toLowerCase();
  if (emailsAdminEnv().includes(normalizado)) {
    return { ok: true, rol: "dueño" };
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("admin_emails")
    .select("rol")
    .eq("email", normalizado)
    .maybeSingle();

  if (data) return { ok: true, rol: data.rol };

  return { ok: false, rol: "" };
}

export async function verifyAdminAuth(req: Request): Promise<AdminAuth> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const jwt = authHeader.slice(7);
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const url = Deno.env.get("SUPABASE_URL")!;

    // Ignorar si envían la anon key como token
    if (jwt !== anonKey) {
      const userClient = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error } = await userClient.auth.getUser(jwt);

      if (!error && user?.email) {
        const porEmail = await esEmailAdmin(user.email);
        if (porEmail.ok) {
          return { email: user.email, userId: user.id, rol: porEmail.rol, metodo: "jwt" };
        }

        const supabase = createServiceClient();
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("rol")
          .eq("id", user.id)
          .maybeSingle();

        if (perfil?.rol === "dueño" || perfil?.rol === "admin") {
          return { email: user.email, userId: user.id, rol: perfil.rol, metodo: "jwt" };
        }
      }
    }
  }

  const key = req.headers.get("x-admin-key");
  const expected = Deno.env.get("ADMIN_API_KEY");
  if (key && expected && key === expected) {
    return { email: "api-key@local", userId: "", rol: "admin", metodo: "api_key" };
  }

  throw new Error("admin_no_autorizado");
}

export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const jwt = authHeader.slice(7);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  if (jwt === anonKey) return null;

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await userClient.auth.getUser(jwt);
  return user;
}
