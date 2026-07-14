/**
 * API del panel admin — D'cuerdas
 */
const BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const FN = (name: string) => `${BASE}/functions/v1/${name}`;

export type AdminStats = {
  visitas_hoy: number;
  clientes_hoy: number;
  cola_activa: number;
  pedidos_pendientes: number;
  clientes_frecuentes: number;
};

export type LlegadaHoy = {
  nombre: string;
  zona: string;
  hora: string;
  es_recurrente: boolean;
  total_visitas: number;
};

export type ClienteFrecuente = {
  nombre: string;
  total_visitas: number;
  visitas_mes: number;
  ultima_visita: string;
  primera_visita: string;
  mesa_habitual: string;
};

export type AdminResumen = {
  stats: AdminStats;
  llegadas_hoy: LlegadaHoy[];
  frecuentes: ClienteFrecuente[];
};

export type PedidoItem = {
  id: number;
  plato_nombre: string;
  cantidad: number;
  nota: string | null;
};

export type PedidoAdmin = {
  id: number;
  nombre_cliente: string;
  zona: string;
  num_personas: number | null;
  nota_cocina: string | null;
  telefono: string | null;
  estado: "pendiente" | "en_preparacion" | "listo" | "entregado" | "cancelado";
  creado_en: string;
  items: PedidoItem[];
};

function adminHeaders(accessToken: string, method = "GET") {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    apikey: ANON,
  };
  if (method !== "GET") h["Content-Type"] = "application/json";
  return h;
}

export const adminApi = {
  resumen: (accessToken: string) =>
    fetch(FN("admin-resumen"), { headers: adminHeaders(accessToken) }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail ?? data.error ?? "Error");
      return data as AdminResumen;
    }),

  pedidos: (accessToken: string) =>
    fetch(FN("admin-pedidos"), { headers: adminHeaders(accessToken) }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail ?? data.error ?? "Error");
      return data as PedidoAdmin[];
    }),

  actualizarPedido: async (accessToken: string, pedido_id: number, estado: string) => {
    const res = await fetch(FN("admin-pedidos"), {
      method: "PATCH",
      headers: adminHeaders(accessToken, "PATCH"),
      body: JSON.stringify({ pedido_id, estado }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? data.error ?? "Error");
    return data;
  },

  verificarAdmin: (accessToken: string) =>
    fetch(FN("verificar-admin"), { headers: adminHeaders(accessToken) }).then((r) => r.json()),
};

export async function registrarVisita(
  numero_mesa: number,
  token: string,
  nombre_cliente: string,
  accessToken?: string,
) {
  const res = await fetch(FN("registrar-visita"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${accessToken ?? ANON}`,
    },
    body: JSON.stringify({ numero_mesa, token, nombre_cliente }),
  });
  if (!res.ok) return null;
  return res.json();
}
