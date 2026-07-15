/**
 * Cliente API — D'cuerdas Karaoke (Supabase Edge Functions)
 */
const BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const FN = (name: string) => `${BASE}/functions/v1/${name}`;

async function post<T>(name: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(FN(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? data.error ?? "Error de API");
  return data as T;
}

export type KaraokeEstado = {
  abierto: boolean;
  horario: { inicio: string; fin: string; zona_horaria: string };
  limite_canciones_por_mesa: number;
  total_mesas: number;
  mensaje: string;
};

export type TipoZona = "mesa" | "karaoke";

export type MesaInfo = {
  mesa_id: number;
  numero_mesa: number;
  tipo: TipoZona;
  etiqueta: string | null;
  nombre_local: string;
};

export type ColaItem = {
  id: number;
  mesa_id: number;
  numero_mesa: number;
  tipo?: TipoZona;
  etiqueta?: string;
  youtube_video_id: string;
  titulo_cancion: string;
  nombre_cliente: string;
  saludo: string | null;
  saludo_momento?: "inicio" | "final";
  estado: "pendiente" | "reproduciendo" | "completada";
  creado_en: string;
  posicion?: number;
};

export type VideoResult = {
  video_id: string;
  titulo: string;
  miniatura_url: string;
  canal: string | null;
};

const busquedaCache = new Map<string, { data: VideoResult[]; expira: number }>();
const CACHE_CLIENTE_MS = 10 * 60 * 1000; // 10 min en el navegador

function normalizarBusqueda(q: string, _modo?: TipoZona): string {
  let t = q.trim().toLowerCase().replace(/\s+/g, " ");
  if (t.length >= 2 && !/\bkaraoke\b/i.test(t)) t = `${t} karaoke`;
  return t;
}

export const api = {
  karaokeEstado: () =>
    fetch(FN("karaoke-estado"), { headers: { apikey: ANON } }).then((r) =>
      r.json() as Promise<KaraokeEstado>,
    ),

  validarMesa: (numero_mesa: number, token: string) =>
    post<MesaInfo>("validar-mesa", { numero_mesa, token }),

  buscarYoutube: async (numero_mesa: number, token: string, q: string, _modo: TipoZona = "musica") => {
    const key = `musica:${normalizarBusqueda(q)}`;
    const cached = busquedaCache.get(key);
    if (cached && cached.expira > Date.now()) {
      return { resultados: cached.data, total: cached.data.length };
    }
    const res = await post<{ resultados: VideoResult[]; total: number }>("buscar-youtube", {
      numero_mesa,
      token,
      q,
      modo: "musica",
    });
    if (res.resultados.length > 0) {
      busquedaCache.set(key, { data: res.resultados, expira: Date.now() + CACHE_CLIENTE_MS });
    }
    return res;
  },

  encolarCancion: (payload: {
    numero_mesa: number;
    token: string;
    youtube_video_id: string;
    titulo_cancion: string;
    nombre_cliente: string;
    saludo?: string;
    saludo_momento?: "inicio" | "final";
  }) => post<ColaItem>("encolar-cancion", payload),

  colaActiva: (accessToken: string) =>
    fetch(FN("cola-activa"), {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON },
    }).then((r) => r.json() as Promise<ColaItem[]>),

  /** Videos ya tocados / en caché BD → música de ambiente del local. */
  radioCasa: async (accessToken: string) => {
    const res = await fetch(FN("radio-casa"), {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? data.error ?? "Error radio");
    return data as { videos: { video_id: string; titulo: string; preferida?: boolean }[]; total: number };
  },

  actualizarEstado: async (accessToken: string, cancion_id: number, estado: string) => {
    const res = await fetch(FN("actualizar-estado-cola"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: ANON,
      },
      body: JSON.stringify({ cancion_id, estado }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? data.error ?? "Error al actualizar");
    return data as ColaItem;
  },

  mesasQrs: (accessToken: string) =>
    fetch(FN("mesas-qrs"), {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: ANON },
    }).then((r) => r.json() as Promise<{ numero_mesa: number; url: string; tipo: TipoZona; etiqueta: string }[]>),

  crearPedido: (payload: {
    numero_mesa: number;
    token: string;
    nombre_cliente: string;
    num_personas?: number;
    nota_cocina?: string;
    telefono?: string;
    items: Array<{ plato_id: number; plato_nombre: string; cantidad: number; nota?: string }>;
  }) => post<{ pedido_id: number; mesa: number; mensaje: string }>("crear-pedido", payload),
};
