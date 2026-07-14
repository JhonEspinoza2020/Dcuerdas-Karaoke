import { createServiceClient } from "./supabase.ts";

export interface Mesa {
  id: number;
  numero_mesa: number;
  token_seguridad: string;
  activa: boolean;
  tipo: "mesa" | "karaoke";
  etiqueta: string | null;
}

export async function obtenerMesaPorNumero(
  numeroMesa: number,
): Promise<Mesa | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("mesas")
    .select("id, numero_mesa, token_seguridad, activa, tipo, etiqueta")
    .eq("numero_mesa", numeroMesa)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function validarMesaToken(
  numeroMesa: number,
  token: string,
): Promise<Mesa> {
  const mesa = await obtenerMesaPorNumero(numeroMesa);
  if (!mesa || !mesa.activa) {
    throw new Error("mesa_no_encontrada");
  }
  if (token !== mesa.token_seguridad) {
    throw new Error("token_invalido");
  }
  return mesa;
}

export function verifyAdminKey(req: Request): void {
  const key = req.headers.get("x-admin-key");
  const expected = Deno.env.get("ADMIN_API_KEY");
  if (!key || !expected || key !== expected) {
    throw new Error("admin_no_autorizado");
  }
}
