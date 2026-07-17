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
  ventana_canciones_minutos?: number;
  total_mesas: number;
  mensaje: string;
};

export type LimiteCola = {
  max_mesa: number;
  ventana_minutos: number;
  usadas_mesa: number;
  restantes_mesa: number;
  espera_segundos: number;
  puede_encolar: boolean;
  motivo: "limite_mesa" | "limite_persona" | "cola_mesa_llena" | null;
  /** Compat. */
  max_persona?: number;
  usadas_persona?: number;
  restantes_persona?: number;
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

export type PedidoMesaItem = {
  id: number;
  plato_nombre: string;
  cantidad: number;
  nota: string | null;
};

export type PedidoMesa = {
  id: number;
  estado: "pendiente" | "en_preparacion" | "listo" | "entregado" | "cancelado";
  creado_en: string;
  items: PedidoMesaItem[];
};

export type VideoResult = {
  video_id: string;
  titulo: string;
  miniatura_url: string;
  canal: string | null;
};

const busquedaCache = new Map<string, { data: VideoResult[]; expira: number }>();
/** Caché corto en mesa (evita resultados viejos bloqueados). */
const CACHE_CLIENTE_MS = 45 * 1000;
/** Admin: más largo para no gastar cuota al reabrir la misma búsqueda. */
const CACHE_ADMIN_MS = 10 * 60 * 1000;

function normalizarBusqueda(q: string, _modo?: TipoZona): string {
  let t = q.trim().toLowerCase().replace(/\s+/g, " ");
  return t;
}

export const api = {
  karaokeEstado: () =>
    fetch(FN("karaoke-estado"), { headers: { apikey: ANON } }).then((r) =>
      r.json() as Promise<KaraokeEstado>,
    ),

  validarMesa: (numero_mesa: number, token: string) =>
    post<MesaInfo>("validar-mesa", { numero_mesa, token }),

  buscarYoutube: async (numero_mesa: number, token: string, q: string, _modo: "musica" = "musica") => {
    const key = `musica:${normalizarBusqueda(q)}`;
    const cached = busquedaCache.get(key);
    if (cached && cached.expira > Date.now()) {
      return { resultados: cached.data, total: cached.data.length };
    }
    const res = await post<{
      resultados: VideoResult[];
      total: number;
      aviso?: string;
      fuente?: string;
    }>("buscar-youtube", {
      numero_mesa,
      token,
      q,
      modo: "musica",
    });
    // No cachear vacíos por cooldown (evita “nunca aparece” durante el wait).
    if (res.resultados.length > 0 && res.fuente !== "cooldown") {
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
  }) => post<ColaItem & { limite?: LimiteCola }>("encolar-cancion", payload),

  consultarLimiteCola: (
    numero_mesa: number,
    token: string,
    nombre_cliente: string,
  ) =>
    post<LimiteCola>("encolar-cancion", {
      consultar: true,
      numero_mesa,
      token,
      nombre_cliente,
    }),

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

  /** El reproductor aprendió que YouTube bloquea este embed. */
  marcarYoutubeBloqueado: async (accessToken: string, video_id: string, motivo = "player_error") => {
    const res = await fetch(FN("marcar-youtube-bloqueado"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: ANON,
      },
      body: JSON.stringify({ video_id, motivo }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail ?? data.error ?? "Error al marcar video");
    }
  },

  adminBuscarYoutube: async (accessToken: string, q: string) => {
    const key = `admin:${q.trim().toLowerCase().replace(/\s+/g, " ")}`;
    const cached = busquedaCache.get(key);
    if (cached && cached.expira > Date.now()) {
      return { resultados: cached.data, total: cached.data.length };
    }
    const res = await fetch(FN("admin-buscar-youtube"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: ANON,
      },
      body: JSON.stringify({ q }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? data.error ?? "Error al buscar");
    const out = data as { resultados: VideoResult[]; total: number };
    if (out.resultados?.length) {
      busquedaCache.set(key, { data: out.resultados, expira: Date.now() + CACHE_ADMIN_MS });
    }
    return out;
  },

  adminEncolarCancion: async (
    accessToken: string,
    payload: { youtube_video_id: string; titulo_cancion: string; nombre_cliente?: string },
  ) => {
    const res = await fetch(FN("admin-encolar-cancion"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: ANON,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? data.error ?? "Error al encolar");
    return data as ColaItem;
  },

  /** Mesa: reporta video que falló el preflight de embed. */
  reportarYoutubeBloqueado: (numero_mesa: number, token: string, video_id: string, motivo = "cliente_preflight") =>
    post<{ ok: boolean }>("reportar-youtube-bloqueado", {
      numero_mesa,
      token,
      video_id,
      motivo,
    }),

  /** Quita un video del caché local de búsquedas del celular. */
  invalidarBusquedaVideo: (video_id: string) => {
    for (const [key, entry] of busquedaCache.entries()) {
      const filtrados = entry.data.filter((v) => v.video_id !== video_id);
      if (filtrados.length !== entry.data.length) {
        if (filtrados.length === 0) busquedaCache.delete(key);
        else busquedaCache.set(key, { ...entry, data: filtrados });
      }
    }
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

  pedidosMesa: (payload: {
    numero_mesa: number;
    token: string;
    pedido_ids?: number[];
  }) => post<{ pedidos: PedidoMesa[] }>("pedidos-mesa", payload),
};
