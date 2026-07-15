import { useCallback, useEffect, useState } from "react";
import { adminApi, supabase, type ClienteFrecuente, type LlegadaHoy } from "@dcuerdas/shared";
import { StarIcon } from "./AdminIcons";

type Props = { accessToken: string };

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientesPanel({ accessToken }: Props) {
  const [frecuentes, setFrecuentes] = useState<ClienteFrecuente[]>([]);
  const [llegadas, setLlegadas] = useState<LlegadaHoy[]>([]);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await adminApi.resumen(accessToken);
      setFrecuentes(res.frecuentes);
      setLlegadas(res.llegadas_hoy);
      setError("");
    } catch {
      setError("No se pudieron cargar los clientes");
    }
  }, [accessToken]);

  useEffect(() => {
    cargar();
    const ch = supabase
      .channel("admin-clientes")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas_clientes" }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  const q = filtro.trim().toLowerCase();
  const frecuentesFiltrados = frecuentes.filter((c) =>
    !q || c.nombre.toLowerCase().includes(q) || c.mesa_habitual.toLowerCase().includes(q),
  );

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Clientes</h1>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <input
        className="admin-search"
        placeholder="Buscar…"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
      />

      <div className="admin-grid-2">
        <section className="admin-card">
          <h2>Hoy ({llegadas.length})</h2>
          {llegadas.length === 0 ? (
            <p className="panel-empty">Sin llegadas.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Zona</th>
                  <th>Hora</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {llegadas.map((l, i) => (
                  <tr key={`${l.nombre}-${i}`}>
                    <td><strong>{l.nombre}</strong></td>
                    <td>{l.zona}</td>
                    <td>{new Date(l.hora).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>
                      {l.es_recurrente ? (
                        <span className="badge-recurrente"><StarIcon size={12} /> Recurrente</span>
                      ) : (
                        <span className="badge-nuevo">Nuevo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="admin-card">
          <h2>Frecuentes ({frecuentesFiltrados.length})</h2>
          {frecuentesFiltrados.length === 0 ? (
            <p className="panel-empty">Sin frecuentes.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Visitas</th>
                  <th>Este mes</th>
                  <th>Zona habitual</th>
                  <th>Última visita</th>
                </tr>
              </thead>
              <tbody>
                {frecuentesFiltrados.map((c) => (
                  <tr key={c.nombre}>
                    <td><strong>{c.nombre}</strong></td>
                    <td><span className="badge-visitas">{c.total_visitas}</span></td>
                    <td>{c.visitas_mes}</td>
                    <td>{c.mesa_habitual}</td>
                    <td>{formatearFecha(c.ultima_visita)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
