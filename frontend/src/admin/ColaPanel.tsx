import { useCallback, useEffect, useState } from "react";
import { api, supabase, type ColaItem } from "@dcuerdas/shared";
import { PlayIcon } from "../cliente/components/Icons";

type Props = { readonly accessToken: string };

export function ColaPanel({ accessToken }: Props) {
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      const data = await api.colaActiva(accessToken);
      if (Array.isArray(data)) setCola(data);
    } catch {
      setError("No se pudo cargar la cola");
    }
  }, [accessToken]);

  useEffect(() => {
    cargar();
    const channel = supabase
      .channel("cola-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cola_reproduccion" },
        () => cargar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cargar]);

  const quitar = async (id: number) => {
    const previa = cola;
    setCola((c) => c.filter((x) => x.id !== id));
    try {
      await api.actualizarEstado(accessToken, id, "completada");
    } catch {
      setCola(previa);
      setError("No se pudo quitar la canción");
    }
  };

  return (
    <div className="panel">
      <h2 className="panel-title">Cola</h2>
      {error && <div className="error-msg">{error}</div>}
      {cola.length === 0 ? (
        <p className="panel-empty">Vacía</p>
      ) : (
        <div className="cola-list">
          {cola.map((c) => (
            <div key={c.id} className={`cola-row ${c.estado}`}>
              <div className="cola-row-info">
                <span className={`cola-estado ${c.estado}`}>
                  {c.estado === "reproduciendo" ? (
                    <><PlayIcon size={12} /> Sonando</>
                  ) : (
                    "En cola"
                  )}
                </span>
                <span className="cola-cancion">{c.titulo_cancion}</span>
                <span className="cola-meta">
                  {c.nombre_cliente} · {c.etiqueta ?? `Mesa ${c.numero_mesa}`}
                </span>
              </div>
              <button className="btn-secondary cola-quitar" onClick={() => quitar(c.id)}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
