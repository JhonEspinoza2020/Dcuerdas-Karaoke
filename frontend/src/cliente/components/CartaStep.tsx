import { useEffect, useState } from "react";
import { api, es, obtenerCarta, type CategoriaCarta } from "@dcuerdas/shared";
import type { CarritoItem, ClienteDatos } from "../types";
import { UtensilsIcon, CheckIcon, PlusIcon, MinusIcon, MusicIcon } from "./Icons";

type Props = {
  numeroMesa: number;
  token: string;
  datos: ClienteDatos;
  onPedidoEnviado: () => void;
  onVolver: () => void;
};

export function CartaStep({ numeroMesa, token, datos, onPedidoEnviado, onVolver }: Props) {
  const [categorias, setCategorias] = useState<CategoriaCarta[]>([]);
  const [catActiva, setCatActiva] = useState(0);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    obtenerCarta()
      .then(setCategorias)
      .catch(() => setError("No se pudo cargar la carta"));
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(""), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const agregar = (plato: { id: number; nombre: string; precio: number }) => {
    setCarrito((prev) => {
      const existe = prev.find((p) => p.plato_id === plato.id);
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
    setLoading(true);
    setError("");
    try {
      await api.crearPedido({
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
      setCarrito([]);
      setAviso(es.carta.pedidoEnviado);
      onPedidoEnviado();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al enviar pedido");
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

  const totalConPrecio = carrito.reduce((s, i) => s + (i.precio > 0 ? i.precio * i.cantidad : 0), 0);
  const tienePrecios = carrito.some((i) => i.precio > 0);

  return (
    <div className="step-card">
      {error && <div className="error-msg">{error}</div>}
      {aviso && (
        <div className="success-msg carta-aviso">
          <CheckIcon size={18} /> {aviso}
        </div>
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
              cat.platos.map((p) => (
                <div key={p.id} className="plato-card">
                  <div className="plato-info">
                    <div className="plato-nombre">{p.nombre}</div>
                    {p.descripcion && <div className="plato-desc">{p.descripcion}</div>}
                    <div className={`plato-precio ${(!p.precio || p.precio <= 0) ? "consultar" : ""}`}>
                      {formatearPrecio(p.precio)}
                    </div>
                  </div>
                  <button className="btn-add" aria-label={es.carta.agregar} onClick={() => agregar(p)}>
                    <PlusIcon size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {carrito.length > 0 && (
        <div className="carrito">
          <div className="carrito-titulo">{es.carta.carrito}</div>
          {carrito.map((i) => (
            <div key={i.plato_id} className="carrito-item">
              <span>{i.plato_nombre}</span>
              <div className="qty-ctrl">
                <button aria-label="Quitar uno" onClick={() => quitar(i.plato_id)}>
                  <MinusIcon size={16} />
                </button>
                <span>{i.cantidad}</span>
                <button
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
          <button className="btn-primary" onClick={enviar} disabled={loading}>
            <UtensilsIcon size={18} />
            {loading ? "Enviando..." : es.carta.enviarPedido}
          </button>
        </div>
      )}

      <button className="btn-secondary" onClick={onVolver}>
        <MusicIcon size={18} /> {es.carta.volverKaraoke}
      </button>
    </div>
  );
}
