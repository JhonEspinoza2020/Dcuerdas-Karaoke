import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  es,
  obtenerCarta,
  supabase,
  COOLDOWNS,
  msRestantesRateLimit,
  marcarRateLimit,
  formatearEspera,
  type CategoriaCarta,
  type PedidoMesa,
} from "@dcuerdas/shared";
import type { CarritoItem, ClienteDatos } from "../types";
import { UtensilsIcon, CheckIcon, PlusIcon, MinusIcon, MusicIcon } from "./Icons";

type Props = {
  readonly numeroMesa: number;
  readonly token: string;
  readonly datos: ClienteDatos;
  readonly onPedidoEnviado: () => void;
  readonly onVolver: () => void;
};

const pedidoStorageKey = (numeroMesa: number) => `dc-pedidos-${numeroMesa}`;
const pedidoNotificadoKey = (numeroMesa: number) => `dc-pedidos-notificados-${numeroMesa}`;

const estadosPedido: Record<PedidoMesa["estado"], { label: string; detalle: string }> = {
  pendiente: { label: "Pedido enviado", detalle: "Lo recibimos y pronto pasará a cocina." },
  en_preparacion: { label: "En cocina", detalle: "Tu pedido se está preparando." },
  listo: { label: "Listo", detalle: "Tu pedido está listo para entregar." },
  entregado: { label: "Entregado", detalle: "Pedido entregado. ¡Buen provecho!" },
  cancelado: { label: "Cancelado", detalle: "Este pedido fue cancelado." },
};

function leerPedidosGuardados(numeroMesa: number): number[] {
  try {
    const raw = window.localStorage.getItem(pedidoStorageKey(numeroMesa));
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids)
      ? ids.filter((id) => Number.isInteger(id) && id > 0).slice(-10)
      : [];
  } catch {
    return [];
  }
}

function guardarPedidoId(numeroMesa: number, pedidoId: number) {
  const ids = leerPedidosGuardados(numeroMesa).filter((id) => id !== pedidoId);
  ids.push(pedidoId);
  window.localStorage.setItem(pedidoStorageKey(numeroMesa), JSON.stringify(ids.slice(-10)));
}

function quitarPedidoId(numeroMesa: number, pedidoId: number) {
  const ids = leerPedidosGuardados(numeroMesa).filter((id) => id !== pedidoId);
  window.localStorage.setItem(pedidoStorageKey(numeroMesa), JSON.stringify(ids));
}

function leerNotificados(numeroMesa: number): number[] {
  try {
    const raw = window.localStorage.getItem(pedidoNotificadoKey(numeroMesa));
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id) && id > 0) : [];
  } catch {
    return [];
  }
}

function marcarNotificado(numeroMesa: number, pedidoId: number) {
  const ids = leerNotificados(numeroMesa).filter((id) => id !== pedidoId);
  ids.push(pedidoId);
  window.localStorage.setItem(pedidoNotificadoKey(numeroMesa), JSON.stringify(ids.slice(-20)));
}

function pedirPermisoNotificaciones() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  Notification.requestPermission().catch(() => {});
}

function notificarPedido(pedido: PedidoMesa, estado: { label: string; detalle: string }) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(`Pedido #${pedido.id}: ${estado.label}`, {
    body: estado.detalle,
    tag: `pedido-${pedido.id}-${pedido.estado}`,
  });
}

export function CartaStep({ numeroMesa, token, datos, onPedidoEnviado, onVolver }: Props) {
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [catActiva, setCatActiva] = useState(0);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pedidosMesa, setPedidosMesa] = useState<PedidoMesa[]>([]);
  const estadosPreviosRef = useRef<Map<number, PedidoMesa["estado"]>>(new Map());

  const cargarCarta = useCallback(() => {
    obtenerCarta()
      .then((carta) => {
        setCategorias(carta);
        const disponibles = new Set(
          carta.flatMap((categoria) => categoria.platos.map((plato) => plato.id)),
        );
        setCarrito((actual) => actual.filter((item) => disponibles.has(item.plato_id)));
        setError("");
      })
      .catch(() => setError("No se pudo cargar la carta"));
  }, []);

  useEffect(() => {
    cargarCarta();
    const ch = supabase
      .channel("carta-cliente")
      .on("postgres_changes", { event: "*", schema: "public", table: "platos" }, () => cargarCarta())
      .on("postgres_changes", { event: "*", schema: "public", table: "categorias_carta" }, () => cargarCarta())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [cargarCarta]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(""), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const cargarPedidosMesa = useCallback(async () => {
    const pedidoIds = leerPedidosGuardados(numeroMesa);
    if (pedidoIds.length === 0) {
      setPedidosMesa([]);
      return;
    }
    const espera = msRestantesRateLimit(`pedidos-mesa-${numeroMesa}`, COOLDOWNS.pedidosMesaMs);
    if (espera > 0) return;
    try {
      marcarRateLimit(`pedidos-mesa-${numeroMesa}`);
      const res = await api.pedidosMesa({ numero_mesa: numeroMesa, token, pedido_ids: pedidoIds });
      setPedidosMesa(res.pedidos);
    } catch {
      /* No bloquear la carta si falla el seguimiento. */
    }
  }, [numeroMesa, token]);

  useEffect(() => {
    void cargarPedidosMesa();
    const id = window.setInterval(() => {
      void cargarPedidosMesa();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [cargarPedidosMesa]);

  useEffect(() => {
    const notificados = new Set(leerNotificados(numeroMesa));
    const timers: number[] = [];
    for (const pedido of pedidosMesa) {
      const previo = estadosPreviosRef.current.get(pedido.id);
      const cerrado = pedido.estado === "entregado" || pedido.estado === "cancelado";
      const recienCambio = previo !== undefined && previo !== pedido.estado;
      if ((pedido.estado === "listo" || pedido.estado === "entregado") && recienCambio && !notificados.has(pedido.id)) {
        const estado = estadosPedido[pedido.estado];
        notificarPedido(pedido, estado);
        marcarNotificado(numeroMesa, pedido.id);
        notificados.add(pedido.id);
      }
      if (cerrado) {
        const t = window.setTimeout(() => {
          quitarPedidoId(numeroMesa, pedido.id);
          setPedidosMesa((lista) => lista.filter((p) => p.id !== pedido.id));
        }, recienCambio ? 8000 : 2500);
        timers.push(t);
      }
      estadosPreviosRef.current.set(pedido.id, pedido.estado);
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [numeroMesa, pedidosMesa]);

  useEffect(() => {
    if (carrito.length === 0) setCarritoAbierto(false);
  }, [carrito.length]);

  const agregar = (plato: { id: number; nombre: string; precio: number }) => {
    setError("");
    setCarrito((prev) => {
      const existe = prev.some((p) => p.plato_id === plato.id);
      if (existe) {
        return prev.map((p) =>
          p.plato_id === plato.id ? { ...p, cantidad: p.cantidad + 1 } : p,
        );
      }
      return [...prev, { plato_id: plato.id, plato_nombre: plato.nombre, precio: plato.precio, cantidad: 1 }];
    });
  };

  const quitar = (platoId: number) => {
    setCarrito((prev) => {
      const item = prev.find((p) => p.plato_id === platoId);
      if (!item) return prev;
      if (item.cantidad <= 1) return prev.filter((p) => p.plato_id !== platoId);
      return prev.map((p) => p.plato_id === platoId ? { ...p, cantidad: p.cantidad - 1 } : p);
    });
  };

  const enviar = async () => {
    if (carrito.length === 0) return;
    const espera = msRestantesRateLimit(`pedido-${numeroMesa}`, COOLDOWNS.pedidoMs);
    if (espera > 0) {
      setError(`Espera ${formatearEspera(espera)} antes de enviar otro pedido.`);
      setCarritoAbierto(true);
      return;
    }
    pedirPermisoNotificaciones();
    setLoading(true);
    setError("");
    try {
      const pedido = await api.crearPedido({
        numero_mesa: numeroMesa,
        token,
        nombre_cliente: datos.nombre,
        num_personas: datos.numPersonas ? Number(datos.numPersonas) : undefined,
        nota_cocina: datos.notaCocina || undefined,
        telefono: datos.telefono || undefined,
        items: carrito.map((i) => ({
          plato_id: i.plato_id,
          plato_nombre: i.plato_nombre,
          cantidad: i.cantidad,
        })),
      });
      marcarRateLimit(`pedido-${numeroMesa}`);
      setCarrito([]);
      setCarritoAbierto(false);
      guardarPedidoId(numeroMesa, pedido.pedido_id);
      setAviso(`Pedido #${pedido.pedido_id} enviado a cocina`);
      void cargarPedidosMesa();
      navigator.vibrate?.(100);
      onPedidoEnviado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar pedido");
      setCarritoAbierto(true);
    } finally {
      setLoading(false);
    }
  };

  const cat = categorias[catActiva];
  const esReservacion = cat?.nombre === "Platos a reservación";

  const formatearPrecio = (precio: number) => {
    if (!precio || precio <= 0) return es.carta.consultarPrecio;
    return `${es.carta.precio} ${Number(precio).toFixed(2)}`;
  };

  const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
  const totalConPrecio = carrito.reduce((s, i) => s + (i.precio > 0 ? i.precio * i.cantidad : 0), 0);
  const tienePrecios = carrito.some((i) => i.precio > 0);
  const pedidosVisibles = pedidosMesa.filter((p) => p.estado !== "entregado" && p.estado !== "cancelado");
  const ultimosCerrados = pedidosMesa
    .filter((p) => p.estado === "entregado" || p.estado === "cancelado")
    .slice(0, 2);
  const cantidadEnCarrito = (platoId: number) =>
    carrito.find((i) => i.plato_id === platoId)?.cantidad ?? 0;

  return (
    <div className={`step-card ${carrito.length > 0 ? "has-carrito-bar" : ""}`}>
      {error && <div className="error-msg">{error}</div>}
      {aviso && (
        <div className="success-msg carta-aviso" role="status" aria-live="polite">
          <CheckIcon size={20} />
          <span>
            <strong>¡Pedido recibido!</strong>
            {aviso}
          </span>
        </div>
      )}

      {(pedidosVisibles.length > 0 || ultimosCerrados.length > 0) && (
        <section className="pedido-cliente-panel" aria-label="Estado de tus pedidos">
          <div className="pedido-cliente-title">Tu pedido</div>
          {[...pedidosVisibles, ...ultimosCerrados].map((p) => {
            const estado = estadosPedido[p.estado];
            return (
              <article key={p.id} className={`pedido-cliente-card is-${p.estado}`}>
                <div>
                  <strong>#{p.id} · {estado.label}</strong>
                  <span>{estado.detalle}</span>
                  <em>{p.items.map((i) => `${i.cantidad}× ${i.plato_nombre}`).join(", ")}</em>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {categorias.length > 0 && (
        <div className="cat-tabs-wrap">
          <div className="cat-tabs">
            {categorias.map((c, i) => (
              <button
                key={c.id}
                className={`cat-tab ${i === catActiva ? "active" : ""}`}
                onClick={() => setCatActiva(i)}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {cat && (
        <>
          {esReservacion && (
            <div className="cat-aviso">{es.carta.reservacion}</div>
          )}
          <div className="platos-list">
            {cat.platos.length === 0 ? (
              <p className="loading">Próximamente...</p>
            ) : (
              cat.platos.map((p) => {
                const qty = cantidadEnCarrito(p.id);
                return (
                  <div key={p.id} className={`plato-card ${qty > 0 ? "en-carrito" : ""}`}>
                    <div className="plato-info">
                      <div className="plato-nombre">{p.nombre}</div>
                      {p.descripcion && <div className="plato-desc">{p.descripcion}</div>}
                      <div className={`plato-precio ${(!p.precio || p.precio <= 0) ? "consultar" : ""}`}>
                        {formatearPrecio(p.precio)}
                      </div>
                    </div>
                    {qty > 0 ? (
                      <div className="qty-ctrl plato-qty">
                        <button type="button" aria-label="Quitar uno" onClick={() => quitar(p.id)}>
                          <MinusIcon size={16} />
                        </button>
                        <span>{qty}</span>
                        <button
                          type="button"
                          aria-label="Agregar uno"
                          onClick={() => agregar({ id: p.id, nombre: p.nombre, precio: p.precio })}
                        >
                          <PlusIcon size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-add"
                        aria-label={es.carta.agregar}
                        onClick={() => agregar({ id: p.id, nombre: p.nombre, precio: p.precio })}
                      >
                        <PlusIcon size={18} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      <button className="btn-secondary" onClick={onVolver}>
        <MusicIcon size={18} /> {es.carta.volverKaraoke}
      </button>

      {carrito.length > 0 && (
        <>
          {carritoAbierto && (
            <button
              type="button"
              className="carrito-backdrop"
              aria-label="Cerrar pedido"
              onClick={() => setCarritoAbierto(false)}
            />
          )}
          <div className={`carrito-dock ${carritoAbierto ? "is-open" : ""}`}>
            {carritoAbierto && (
              <div className="carrito carrito-sheet" aria-label={es.carta.carrito}>
                <div className="carrito-sheet-head">
                  <div className="carrito-titulo">{es.carta.carrito}</div>
                  <button type="button" className="btn-text" onClick={() => setCarritoAbierto(false)}>
                    Cerrar
                  </button>
                </div>
                {carrito.map((i) => (
                  <div key={i.plato_id} className="carrito-item">
                    <span>{i.plato_nombre}</span>
                    <div className="qty-ctrl">
                      <button type="button" aria-label="Quitar uno" onClick={() => quitar(i.plato_id)}>
                        <MinusIcon size={16} />
                      </button>
                      <span>{i.cantidad}</span>
                      <button
                        type="button"
                        aria-label="Agregar uno"
                        onClick={() => agregar({ id: i.plato_id, nombre: i.plato_nombre, precio: i.precio })}
                      >
                        <PlusIcon size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="carrito-total">
                  {tienePrecios
                    ? `Total: ${es.carta.precio} ${totalConPrecio.toFixed(2)}`
                    : es.carta.consultarPrecio}
                </div>
              </div>
            )}
            <div className="carrito-bar">
              <button
                type="button"
                className="carrito-bar-info"
                onClick={() => setCarritoAbierto((v) => !v)}
                aria-expanded={carritoAbierto}
              >
                <span className="carrito-bar-badge">{totalItems}</span>
                <span className="carrito-bar-text">
                  <strong>{carritoAbierto ? "Ocultar" : "Ver pedido"}</strong>
                  <em>
                    {tienePrecios
                      ? `${es.carta.precio} ${totalConPrecio.toFixed(2)}`
                      : es.carta.consultarPrecio}
                  </em>
                </span>
              </button>
              <button
                type="button"
                className="btn-primary carrito-bar-enviar"
                onClick={enviar}
                disabled={loading}
              >
                <UtensilsIcon size={18} />
                {loading ? "Enviando..." : es.carta.enviarPedido}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
