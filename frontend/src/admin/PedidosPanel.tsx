import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, supabase, type PedidoAdmin, type PedidosFiltro } from "@dcuerdas/shared";

type Props = {
  readonly accessToken: string;
  readonly onActiveCountChange?: (count: number) => void;
};

type EstadoActivo = "pendiente" | "en_preparacion" | "listo";

const COLUMNAS: {
  valor: EstadoActivo;
  label: string;
  siguiente?: PedidoAdmin["estado"];
  accion: string;
}[] = [
  { valor: "pendiente", label: "Pendiente", siguiente: "en_preparacion", accion: "A cocina" },
  { valor: "en_preparacion", label: "En cocina", siguiente: "listo", accion: "Marcar listo" },
  { valor: "listo", label: "Listo", siguiente: "entregado", accion: "Entregado" },
];

const URGENTE_MS = 10 * 60 * 1000;
const POLL_MS = 15_000;

function minutosDesde(iso: string, ahora: number): number {
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60_000));
}

function textoEspera(iso: string, ahora: number): string {
  const mins = minutosDesde(iso, ahora);
  if (mins < 1) return "Ahora";
  if (mins === 1) return "Hace 1 min";
  if (mins < 60) return `Hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  const resto = mins % 60;
  if (resto === 0) return horas === 1 ? "Hace 1 h" : `Hace ${horas} h`;
  return `Hace ${horas}h ${resto}m`;
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function ordenarPorAntiguedad(a: PedidoAdmin, b: PedidoAdmin) {
  return new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime();
}

function esActivo(estado: PedidoAdmin["estado"]) {
  return estado === "pendiente" || estado === "en_preparacion" || estado === "listo";
}

function subtotalPedido(p: PedidoAdmin): number {
  if (typeof p.subtotal === "number" && Number.isFinite(p.subtotal)) return p.subtotal;
  return p.items.reduce(
    (s, i) => s + (Number(i.precio_unitario) || 0) * i.cantidad,
    0,
  );
}

function formatearMonto(n: number): string {
  if (!n || n <= 0) return "";
  return `S/ ${n.toFixed(2)}`;
}

function etiquetaAccion(base: string, subtotal: number): string {
  if (subtotal <= 0) return base;
  return `${base} · S/ ${subtotal.toFixed(2)}`;
}

function textoBotonPedido(
  col: (typeof COLUMNAS)[number],
  subtotal: number,
): string {
  if (col.siguiente === "entregado") return etiquetaAccion(col.accion, subtotal);
  return col.accion;
}

export function PedidosPanel({ accessToken, onActiveCountChange }: Props) {
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<PedidosFiltro>("jornada");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const debounceRef = useRef(0);
  const filtroRef = useRef(filtro);
  const rangoRef = useRef({ desde, hasta });
  const cargarRef = useRef<(silencioso?: boolean) => Promise<void>>(async () => {});

  filtroRef.current = filtro;
  rangoRef.current = { desde, hasta };

  const queryActual = useCallback(() => {
    const f = filtroRef.current;
    const r = rangoRef.current;
    if (f === "rango") {
      return { filtro: f, desde: r.desde || undefined, hasta: r.hasta || undefined };
    }
    return { filtro: f };
  }, []);

  const cargar = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setCargando(true);
      const data = await adminApi.pedidos(accessToken, queryActual());
      if (Array.isArray(data)) setPedidos(data);
      setError("");
    } catch {
      setError("No se pudieron cargar los pedidos");
    } finally {
      setCargando(false);
    }
  }, [accessToken, queryActual]);

  cargarRef.current = cargar;

  const cargarSilencioso = useCallback((delayMs = 350) => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void cargarRef.current(true);
    }, delayMs);
  }, []);

  useEffect(() => {
    void cargar(false);
    const ch = supabase
      .channel("admin-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        cargarSilencioso(350);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_items" }, () => {
        cargarSilencioso(200);
      })
      .subscribe();
    const poll = window.setInterval(() => {
      void cargarRef.current(true);
    }, POLL_MS);
    return () => {
      window.clearTimeout(debounceRef.current);
      window.clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [accessToken, cargar, cargarSilencioso]);

  useEffect(() => {
    void cargar(false);
  }, [filtro, desde, hasta, cargar]);

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const porColumna = useMemo(() => {
    const map: Record<EstadoActivo, PedidoAdmin[]> = {
      pendiente: [],
      en_preparacion: [],
      listo: [],
    };
    for (const p of pedidos) {
      if (p.estado === "pendiente" || p.estado === "en_preparacion" || p.estado === "listo") {
        map[p.estado].push(p);
      }
    }
    for (const col of COLUMNAS) {
      map[col.valor].sort(ordenarPorAntiguedad);
    }
    return map;
  }, [pedidos]);

  const historial = useMemo(
    () =>
      pedidos
        .filter((p) => p.estado === "entregado" || p.estado === "cancelado")
        .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()),
    [pedidos],
  );

  const totalActivos = pedidos.filter((p) => esActivo(p.estado)).length;

  useEffect(() => {
    onActiveCountChange?.(totalActivos);
  }, [onActiveCountChange, totalActivos]);

  let subtitulo = "Sin pedidos activos";
  if (totalActivos === 1) subtitulo = "1 activo · más antiguos primero";
  else if (totalActivos > 1) subtitulo = `${totalActivos} activos · más antiguos primero`;

  let etiquetaFiltro = "esta jornada";
  if (filtro === "hoy") etiquetaFiltro = "hoy";
  else if (filtro === "rango") etiquetaFiltro = "en el rango";

  const cambiarEstado = async (id: number, estado: PedidoAdmin["estado"]) => {
    const previa = pedidos;
    setActualizando(id);
    setError("");
    setPedidos((lista) =>
      lista.map((p) => (p.id === id ? { ...p, estado } : p)),
    );
    try {
      await adminApi.actualizarPedido(accessToken, id, estado);
      void cargar(true);
    } catch {
      setPedidos(previa);
      setError("No se pudo actualizar el pedido");
    } finally {
      setActualizando(null);
    }
  };

  return (
    <div className="admin-panel pedidos-panel">
      <header className="admin-panel-head pedidos-panel-head">
        <div>
          <h1>Pedidos</h1>
          <p className="admin-panel-sub">{subtitulo}</p>
        </div>
      </header>

      {error && <div className="error-msg">{error}</div>}

      {cargando && pedidos.length === 0 ? (
        <p className="panel-empty">Cargando pedidos…</p>
      ) : (
        <>
          <div className="pedidos-board">
            {COLUMNAS.map((col) => {
              const lista = porColumna[col.valor];
              return (
                <section key={col.valor} className={`pedidos-col pedidos-col--${col.valor}`}>
                  <header className="pedidos-col-head">
                    <h2>{col.label}</h2>
                    <span className="pedidos-col-count">{lista.length}</span>
                  </header>

                  <div className="pedidos-col-list">
                    {lista.length === 0 ? (
                      <p className="pedidos-col-empty">Vacío</p>
                    ) : (
                      lista.map((p) => {
                        const esperaMs = ahora - new Date(p.creado_en).getTime();
                        const urgente = esperaMs >= URGENTE_MS;
                        const sub = subtotalPedido(p);
                        return (
                          <article
                            key={p.id}
                            className={`pedido-card estado-${p.estado}${urgente ? " is-urgente" : ""}`}
                          >
                            <div className="pedido-card-head">
                              <div>
                                <span className="pedido-zona">{p.zona}</span>
                                <h3>{p.nombre_cliente}</h3>
                                <span className={`pedido-hora${urgente ? " is-urgente" : ""}`}>
                                  {textoEspera(p.creado_en, ahora)}
                                  <span className="pedido-hora-abs"> · {horaCorta(p.creado_en)}</span>
                                </span>
                              </div>
                            </div>

                            <ul className="pedido-items">
                              {p.items.map((item) => (
                                <li key={item.id}>
                                  <span className="pedido-cant">{item.cantidad}x</span>
                                  {item.plato_nombre}
                                  {item.nota && (
                                    <em className="pedido-nota-item"> ({item.nota})</em>
                                  )}
                                </li>
                              ))}
                            </ul>

                            {p.nota_cocina && (
                              <p className="pedido-nota">Nota: {p.nota_cocina}</p>
                            )}

                            <div className="pedido-acciones">
                              {col.siguiente && (
                                <button
                                  type="button"
                                  className="btn-primary"
                                  disabled={actualizando === p.id}
                                  onClick={() => cambiarEstado(p.id, col.siguiente!)}
                                >
                                  {actualizando === p.id
                                    ? "…"
                                    : textoBotonPedido(col, sub)}
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-text pedido-cancelar"
                                disabled={actualizando === p.id}
                                onClick={() => cambiarEstado(p.id, "cancelado")}
                              >
                                Cancelar
                              </button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="pedidos-historial" aria-label="Entregados de la jornada">
            <header className="pedidos-historial-head">
              <h2>Entregados / cancelados</h2>
              <span>{historial.length} {etiquetaFiltro}</span>
            </header>

            <div className="pedidos-historial-toolbar">
              <div className="pedidos-filtro-tabs" role="group" aria-label="Filtro de fechas">
                {([
                  ["jornada", "Jornada"],
                  ["hoy", "Hoy"],
                  ["rango", "Rango"],
                ] as const).map(([valor, label]) => (
                  <button
                    key={valor}
                    type="button"
                    className={`pedidos-filtro-tab${filtro === valor ? " active" : ""}`}
                    onClick={() => setFiltro(valor)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filtro === "rango" && (
                <div className="pedidos-rango">
                  <label>
                    Desde
                    <input
                      type="date"
                      value={desde}
                      onChange={(e) => setDesde(e.target.value)}
                    />
                  </label>
                  <label>
                    Hasta
                    <input
                      type="date"
                      value={hasta}
                      onChange={(e) => setHasta(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>

            {historial.length === 0 ? (
              <p className="pedidos-historial-empty">
                Aquí aparecen los pedidos entregados o cancelados del filtro elegido.
              </p>
            ) : (
              <ul className="pedidos-historial-list">
                {historial.map((p) => {
                  const sub = subtotalPedido(p);
                  return (
                    <li key={p.id} className={`pedidos-hist-row is-${p.estado}`}>
                      <div className="pedidos-hist-main">
                        <strong>{p.zona}</strong>
                        <span>{p.nombre_cliente}</span>
                        <em>
                          {p.items.map((i) => `${i.cantidad}× ${i.plato_nombre}`).join(", ")}
                        </em>
                      </div>
                      <div className="pedidos-hist-meta">
                        <span className={`pedidos-hist-badge is-${p.estado}`}>
                          {p.estado === "entregado" ? "Entregado" : "Cancelado"}
                        </span>
                        {sub > 0 && (
                          <span className="pedidos-hist-monto">{formatearMonto(sub)}</span>
                        )}
                        <time dateTime={p.creado_en}>{horaCorta(p.creado_en)}</time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
