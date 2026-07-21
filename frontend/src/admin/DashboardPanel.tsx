import { useCallback, useEffect, useState } from "react";
import { adminApi, supabase, type AdminResumen } from "@dcuerdas/shared";
import { StarIcon, ClockIcon } from "./AdminIcons";

type Props = { accessToken: string };

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

/** Clave de jornada actual (apertura ~17:30 Lima). */
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

export function DashboardPanel({ accessToken }: Props) {
  const [data, setData] = useState<AdminResumen | null>(null);
  const [error, setError] = useState("");
  const [fecha, setFecha] = useState(claveJornadaHoy);

  const cargar = useCallback(async () => {
    try {
      const res = await adminApi.resumen(accessToken, fecha);
      setData(res);
      setError("");
    } catch {
      setError("No se pudo cargar el resumen");
    }
  }, [accessToken, fecha]);

  useEffect(() => {
    cargar();
    const ch = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas_clientes" }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "cola_reproduccion" }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, cargar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cargar]);

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

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Resumen</h1>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-valor">{stats.clientes_hoy}</span>
          <span className="stat-etiqueta">{esHoy ? "Clientes hoy" : "Clientes jornada"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-valor">{stats.visitas_hoy}</span>
          <span className="stat-etiqueta">Llegadas</span>
        </div>
        <div className="stat-card accent">
          <span className="stat-valor">{stats.cola_activa}</span>
          <span className="stat-etiqueta">En cola</span>
        </div>
        <div className="stat-card">
          <span className="stat-valor">{stats.pedidos_pendientes}</span>
          <span className="stat-etiqueta">Pedidos activos</span>
        </div>
        <div className="stat-card gold">
          <span className="stat-valor">{stats.clientes_frecuentes}</span>
          <span className="stat-etiqueta">Clientes frecuentes</span>
        </div>
        <div className="stat-card yt-quota">
          <span className="stat-valor">
            {ytUsadas}/{ytMax}
          </span>
          <span className="stat-etiqueta">Búsquedas YouTube hoy</span>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-card">
          <div className="carta-section-head">
            <h2>
              <ClockIcon size={18} /> Llegadas
            </h2>
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
          <h2>
            <StarIcon size={18} /> Frecuentes
          </h2>
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
    </div>
  );
}
