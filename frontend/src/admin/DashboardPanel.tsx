import { useCallback, useEffect, useState } from "react";
import { adminApi, api, supabase, zonaCola, type AdminResumen, type ColaItem } from "@dcuerdas/shared";
import { StarIcon, ClockIcon, UsersIcon, QueueIcon, FlameIcon } from "./AdminIcons";
import { abrirReproductorVentana } from "./abrirReproductorVentana";
import { mostrarReproductorBubble } from "./ReproductorBubble";
import {
  miniaturaYoutube,
  suscribirNowPlaying,
  type NowPlayingPayload,
} from "./nowPlayingChannel";

type Props = {
  readonly accessToken: string;
  readonly onAbrirCola?: () => void;
};

function decodeHtml(texto: string): string {
  const area = document.createElement("textarea");
  area.innerHTML = texto;
  return area.value;
}

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  });
}

function claveJornadaHoy(): string {
  const lima = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  const mins = lima.getHours() * 60 + lima.getMinutes();
  if (mins < 17 * 60 + 30) lima.setDate(lima.getDate() - 1);
  const y = lima.getFullYear();
  const m = String(lima.getMonth() + 1).padStart(2, "0");
  const d = String(lima.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function etiquetaJornada(clave: string): string {
  const [y, m, d] = clave.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fechaHoraAhora(): string {
  return new Date().toLocaleString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  });
}

export function DashboardPanel({ accessToken, onAbrirCola }: Props) {
  const [data, setData] = useState<AdminResumen | null>(null);
  const [error, setError] = useState("");
  const [fecha, setFecha] = useState(claveJornadaHoy);
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [ahoraReloj, setAhoraReloj] = useState(fechaHoraAhora);
  const [nowLive, setNowLive] = useState<NowPlayingPayload | null>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await adminApi.resumen(accessToken, fecha);
      setData(res);
      setError("");
    } catch {
      setError("No se pudo cargar el resumen");
    }
  }, [accessToken, fecha]);

  const cargarCola = useCallback(async () => {
    try {
      const rows = await api.colaActiva(accessToken);
      setCola(Array.isArray(rows) ? rows : []);
    } catch {
      setCola([]);
    }
  }, [accessToken]);

  useEffect(() => {
    cargar();
    cargarCola();
    const unsubNow = suscribirNowPlaying(setNowLive);
    const ch = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas_clientes" }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "cola_reproduccion" }, () => {
        cargar();
        cargarCola();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, cargar)
      .subscribe();
    const clock = window.setInterval(() => setAhoraReloj(fechaHoraAhora()), 30_000);
    return () => {
      unsubNow();
      supabase.removeChannel(ch);
      window.clearInterval(clock);
    };
  }, [cargar, cargarCola]);

  if (!data) {
    return (
      <div className="admin-panel">
        {error ? <div className="error-msg">{error}</div> : <p className="panel-empty">Cargando...</p>}
      </div>
    );
  }

  const { stats, llegadas_hoy, frecuentes, youtube_busquedas, jornada } = data;
  const ytUsadas = youtube_busquedas?.usadas ?? stats.youtube_usadas ?? 0;
  const ytMax = youtube_busquedas?.max ?? stats.youtube_max ?? 100;
  const esHoy = jornada?.es_hoy ?? fecha === claveJornadaHoy();

  const reproduciendo = cola.find((c) => c.estado === "reproduciendo") ?? null;
  const siguientes = cola
    .filter((c) => c.estado === "pendiente" && c.id !== reproduciendo?.id)
    .slice(0, 5);

  // Lo que suena de verdad en la pestaña Reproductor (cola o ambiente).
  const heartbeatOk =
    !!nowLive?.youtube_video_id &&
    nowLive.ts != null &&
    Date.now() - nowLive.ts <= 4000;
  const liveActivo = heartbeatOk;
  const ahora = liveActivo
    ? {
        videoId: nowLive!.youtube_video_id!,
        titulo: decodeHtml(
          nowLive!.titulo?.trim() || (nowLive!.esAmbiente ? "Música de ambiente" : "Sin título"),
        ),
        meta: nowLive!.esAmbiente
          ? "Música de ambiente"
          : nowLive!.nombre_cliente && nowLive!.nombre_cliente !== "Local"
            ? nowLive!.nombre_cliente
            : "",
        badge: nowLive!.esAmbiente
          ? "Ambiente"
          : nowLive!.numero_mesa != null && nowLive!.numero_mesa > 0
            ? `Mesa ${nowLive!.numero_mesa}`
            : nowLive!.nombre_cliente === "Local" || !nowLive!.numero_mesa
              ? "Local"
              : "",
        esAmbiente: nowLive!.esAmbiente,
      }
    : reproduciendo
      ? {
          videoId: reproduciendo.youtube_video_id,
          titulo: decodeHtml(reproduciendo.titulo_cancion),
          meta:
            reproduciendo.nombre_cliente !== zonaCola(reproduciendo)
              ? reproduciendo.nombre_cliente
              : "",
          badge: zonaCola(reproduciendo),
          esAmbiente: false,
        }
      : null;

  return (
    <div className="admin-panel dash-home">
      <header className="dash-home-head">
        <h1 className="dash-home-saludo">Resumen</h1>
        <div className="dash-home-clock" aria-live="polite">
          {ahoraReloj}
        </div>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <div className="dash-home-grid">
        <div className="dash-home-main">
          <button
            type="button"
            className="dash-now"
            onClick={() => {
              mostrarReproductorBubble();
              abrirReproductorVentana();
            }}
            title="Abrir reproductor"
          >
            <div className="dash-now-label">
              {ahora?.esAmbiente ? "Ahora suena" : "Ahora cantando"}
            </div>
            {ahora ? (
              <div className="dash-now-body">
                <img
                  className="dash-now-thumb"
                  src={miniaturaYoutube(ahora.videoId)}
                  alt=""
                />
                <div className="dash-now-info">
                  <div className="dash-now-titulo">{ahora.titulo}</div>
                  {ahora.meta ? <div className="dash-now-meta">{ahora.meta}</div> : null}
                  {ahora.badge ? <span className="dash-now-mesa">{ahora.badge}</span> : null}
                </div>
              </div>
            ) : (
              <div className="dash-now-empty">
                <p>Nadie cantando ahora.</p>
                <span>Abrir reproductor / ambiente</span>
              </div>
            )}
          </button>

          <section
            className="dash-next admin-card"
            data-count={siguientes.length || 1}
          >
            <div className="carta-section-head">
              <h2>Siguiente en la cola</h2>
              <button type="button" className="dash-link" onClick={onAbrirCola}>
                Ver cola completa →
              </button>
            </div>
            {siguientes.length === 0 ? (
              <p className="panel-empty dash-next-empty">Sin canciones en espera.</p>
            ) : (
              <ul className="dash-next-list">
                {siguientes.map((c) => (
                  <li key={c.id} className="dash-next-item">
                    <img
                      src={miniaturaYoutube(c.youtube_video_id)}
                      alt=""
                      className="dash-next-avatar"
                    />
                    <div className="dash-next-text">
                      <span className="dash-next-nombre">
                        {c.nombre_cliente === zonaCola(c) ? zonaCola(c) : c.nombre_cliente}
                      </span>
                      <span className="dash-next-cancion">{c.titulo_cancion}</span>
                    </div>
                    {c.nombre_cliente !== zonaCola(c) && (
                      <span className="dash-next-mesa">{zonaCola(c)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="dash-home-side">
          <div className="dash-stat-stack">
            <div className="dash-stat">
              <UsersIcon size={18} />
              <span className="dash-stat-valor">{stats.clientes_hoy}</span>
              <span className="dash-stat-etiqueta">
                {esHoy ? "Clientes hoy" : "Clientes jornada"}
              </span>
            </div>
            <div className="dash-stat">
              <QueueIcon size={18} />
              <span className="dash-stat-valor">{stats.cola_activa}</span>
              <span className="dash-stat-etiqueta">En cola</span>
            </div>
            <div className="dash-stat">
              <FlameIcon size={18} />
              <span className="dash-stat-valor">{stats.clientes_frecuentes}</span>
              <span className="dash-stat-etiqueta">Frecuentes</span>
            </div>
            <div className="dash-stat dash-stat--yt">
              <span className="dash-stat-valor">
                {ytUsadas}/{ytMax}
              </span>
              <span className="dash-stat-etiqueta">YouTube hoy</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat-valor">{stats.pedidos_pendientes}</span>
              <span className="dash-stat-etiqueta">Pedidos activos</span>
            </div>
          </div>
        </aside>
      </div>

      <section className="dash-tpu" aria-labelledby="dash-tpu-titulo">
        <h2 id="dash-tpu-titulo" className="dash-tpu-titulo">
          Clientes
        </h2>
        <div className="admin-grid-2 dash-home-bottom">
          <section className="admin-card">
            <div className="carta-section-head">
              <h3>
                <ClockIcon size={18} /> Llegadas
              </h3>
              <div className="dashboard-fecha-filtro">
                <label>
                  <span className="sr-only">Fecha de jornada</span>
                  <input
                    type="date"
                    value={fecha}
                    max={claveJornadaHoy()}
                    onChange={(e) => setFecha(e.target.value || claveJornadaHoy())}
                  />
                </label>
                {!esHoy && (
                  <button
                    type="button"
                    className="btn-secondary dashboard-hoy-btn"
                    onClick={() => setFecha(claveJornadaHoy())}
                  >
                    Hoy
                  </button>
                )}
              </div>
            </div>
            <p className="dashboard-jornada-meta">
              Jornada {etiquetaJornada(fecha)} · {llegadas_hoy.length} cliente
              {llegadas_hoy.length === 1 ? "" : "s"}
              {!esHoy ? " (histórico)" : ""}
            </p>
            {llegadas_hoy.length === 0 ? (
              <p className="panel-empty">Sin llegadas en esa jornada.</p>
            ) : (
              <ul className="admin-lista admin-lista--scroll">
                {llegadas_hoy.map((l) => (
                  <li key={`${l.nombre}-${l.hora}-${l.zona}`} className="admin-lista-item">
                    <div className="admin-lista-main">
                      <span className="admin-lista-nombre">{l.nombre}</span>
                      {l.es_recurrente && (
                        <span className="badge-recurrente" title="Cliente recurrente">
                          <StarIcon size={12} /> Frecuente
                        </span>
                      )}
                    </div>
                    <div className="admin-lista-meta">
                      {l.zona} · {formatearHora(l.hora)}
                      {l.total_visitas > 1 && ` · ${l.total_visitas} visitas`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-card">
            <h3>
              <StarIcon size={18} /> Frecuentes
            </h3>
            {frecuentes.length === 0 ? (
              <p className="panel-empty">Sin frecuentes.</p>
            ) : (
              <ul className="admin-lista admin-lista--scroll">
                {frecuentes.slice(0, 8).map((c) => (
                  <li key={c.nombre} className="admin-lista-item">
                    <div className="admin-lista-main">
                      <span className="admin-lista-nombre">{c.nombre}</span>
                      <span className="badge-visitas">{c.total_visitas} visitas</span>
                    </div>
                    <div className="admin-lista-meta">
                      {c.mesa_habitual} · Última: {formatearFecha(c.ultima_visita)}
                      {c.visitas_mes > 0 && ` · ${c.visitas_mes} este mes`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
