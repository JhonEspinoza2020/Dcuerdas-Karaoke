import { useCallback, useEffect, useState } from "react";
import { adminApi, supabase, type PedidoAdmin } from "@dcuerdas/shared";

type Props = { accessToken: string };

const ESTADOS: { valor: PedidoAdmin["estado"]; label: string; siguiente?: PedidoAdmin["estado"] }[] = [
  { valor: "pendiente", label: "Pendiente", siguiente: "en_preparacion" },
  { valor: "en_preparacion", label: "En cocina", siguiente: "listo" },
  { valor: "listo", label: "Listo", siguiente: "entregado" },
];

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

export function PedidosPanel({ accessToken }: Props) {
  const [pedidos, setPedidos] = useState<PedidoAdmin[]>([]);
  const [error, setError] = useState("");
  const [actualizando, setActualizando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await adminApi.pedidos(accessToken);
      if (Array.isArray(data)) setPedidos(data);
      setError("");
    } catch {
      setError("No se pudieron cargar los pedidos");
    }
  }, [accessToken]);

  useEffect(() => {
    cargar();
    const ch = supabase
      .channel("admin-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cargar]);

  const cambiarEstado = async (id: number, estado: PedidoAdmin["estado"]) => {
    setActualizando(id);
    try {
      await adminApi.actualizarPedido(accessToken, id, estado);
      await cargar();
    } catch {
      setError("No se pudo actualizar el pedido");
    } finally {
      setActualizando(null);
    }
  };

  const cancelar = (id: number) => cambiarEstado(id, "cancelado");

  return (
    <div className="admin-panel">
      <header className="admin-panel-head">
        <h1>Pedidos de cocina</h1>
        <p className="admin-panel-sub">Gestiona los pedidos de mesas y box en tiempo real</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      {pedidos.length === 0 ? (
        <p className="panel-empty">No hay pedidos activos.</p>
      ) : (
        <div className="pedidos-grid">
          {pedidos.map((p) => {
            const config = ESTADOS.find((e) => e.valor === p.estado);
            return (
              <article key={p.id} className={`pedido-card estado-${p.estado}`}>
                <div className="pedido-card-head">
                  <div>
                    <span className="pedido-zona">{p.zona}</span>
                    <h3>{p.nombre_cliente}</h3>
                    <span className="pedido-hora">{formatearHora(p.creado_en)}</span>
                  </div>
                  <span className={`pedido-estado-badge ${p.estado}`}>
                    {config?.label ?? p.estado}
                  </span>
                </div>

                <ul className="pedido-items">
                  {p.items.map((item) => (
                    <li key={item.id}>
                      <span className="pedido-cant">{item.cantidad}x</span>
                      {item.plato_nombre}
                      {item.nota && <em className="pedido-nota-item"> ({item.nota})</em>}
                    </li>
                  ))}
                </ul>

                {p.nota_cocina && (
                  <p className="pedido-nota">Nota: {p.nota_cocina}</p>
                )}

                <div className="pedido-acciones">
                  {config?.siguiente && (
                    <button
                      className="btn-primary"
                      disabled={actualizando === p.id}
                      onClick={() => cambiarEstado(p.id, config.siguiente!)}
                    >
                      {config.siguiente === "en_preparacion" && "A cocina"}
                      {config.siguiente === "listo" && "Marcar listo"}
                      {config.siguiente === "entregado" && "Entregado"}
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    disabled={actualizando === p.id}
                    onClick={() => cancelar(p.id)}
                  >
                    Cancelar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
