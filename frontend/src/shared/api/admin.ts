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
  precio_unitario?: number;
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
  archivado_en?: string | null;
  items: PedidoItem[];
  subtotal?: number;
};

export type PedidosFiltro = "jornada" | "hoy" | "rango";

export type PedidosQuery = {
  filtro?: PedidosFiltro;
  desde?: string;
  hasta?: string;
};

export type PlatoAdmin = {
  id: number;
  categoria_id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  destacado?: boolean;
  orden: number;
  imagen_url?: string | null;
};

export type CategoriaAdmin = {
  id: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activa: boolean;
};

function adminHeaders(accessToken: string, method = "GET") {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    apikey: ANON,
  };
  if (method !== "GET") h["Content-Type"] = "application/json";
  return h;
}

async function adminJson<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const res = await fetch(path, {
    ...init,
    headers: { ...adminHeaders(accessToken, method), ...(init?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? data.error ?? "Error");
  return data as T;
}

export const adminApi = {
  resumen: (accessToken: string) =>
    adminJson<AdminResumen>(accessToken, FN("admin-resumen")),

  pedidos: (accessToken: string, query?: PedidosQuery) => {
    const params = new URLSearchParams();
    if (query?.filtro) params.set("filtro", query.filtro);
    if (query?.desde) params.set("desde", query.desde);
    if (query?.hasta) params.set("hasta", query.hasta);
    const qs = params.toString();
    return adminJson<PedidoAdmin[]>(
      accessToken,
      qs ? `${FN("admin-pedidos")}?${qs}` : FN("admin-pedidos"),
    );
  },

  actualizarPedido: async (accessToken: string, pedido_id: number, estado: string) => {
    return adminJson(accessToken, FN("admin-pedidos"), {
      method: "PATCH",
      body: JSON.stringify({ pedido_id, estado }),
    });
  },

  categorias: (accessToken: string) =>
    adminJson<CategoriaAdmin[]>(accessToken, `${FN("admin-carta")}?recurso=categorias`),

  platos: (accessToken: string) =>
    adminJson<PlatoAdmin[]>(accessToken, `${FN("admin-carta")}?recurso=platos`),

  crearPlato: (
    accessToken: string,
    body: {
      categoria_id: number;
      nombre: string;
      precio: number;
      descripcion?: string | null;
      disponible?: boolean;
    },
  ) =>
    adminJson<PlatoAdmin>(accessToken, `${FN("admin-carta")}?recurso=platos`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  actualizarPlato: (
    accessToken: string,
    body: {
      id: number;
      nombre?: string;
      precio?: number;
      descripcion?: string | null;
      disponible?: boolean;
      categoria_id?: number;
    },
  ) =>
    adminJson<PlatoAdmin>(accessToken, `${FN("admin-carta")}?recurso=platos`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

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
