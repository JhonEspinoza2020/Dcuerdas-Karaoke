import { useCallback, useEffect, useState } from "react";
import { api, supabase, type ColaItem } from "@dcuerdas/shared";
import { PlayIcon } from "../cliente/components/Icons";

type Props = {
  readonly accessToken: string;
  readonly onCountChange?: (count: number) => void;
};

const POLL_MS = 15_000;

function textoEspera(iso: string, ahora: number): string {
  const mins = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "Ahora";
  if (mins === 1) return "Hace 1 min";
  if (mins < 60) return `Hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  const resto = mins % 60;
  if (resto === 0) return horas === 1 ? "Hace 1 h" : `Hace ${horas} h`;
  return `Hace ${horas}h ${resto}m`;
}

export function ColaPanel({ accessToken, onCountChange }: Props) {
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [error, setError] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    try {
      const data = await api.colaActiva(accessToken);
      const lista = Array.isArray(data) ? data : [];
      setCola(lista);
      onCountChange?.(
        lista.filter((c) => c.estado === "pendiente" || c.estado === "reproduciendo").length,
      );
      setError("");
    } catch {
      setError("No se pudo cargar la cola");
      setCola([]);
      onCountChange?.(0);
    }
  }, [accessToken, onCountChange]);

  useEffect(() => {
    void cargar();
    const channel = supabase
      .channel("cola-panel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cola_reproduccion" },
        () => {
          void cargar();
        },
      )
      .subscribe();
    const poll = window.setInterval(() => {
      void cargar();
    }, POLL_MS);
    const tick = window.setInterval(() => setAhora(Date.now()), 30_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [cargar]);

  const quitar = async (id: number) => {
    const previa = cola;
    const siguiente = cola.filter((x) => x.id !== id);
    setCola(siguiente);
    onCountChange?.(
      siguiente.filter((c) => c.estado === "pendiente" || c.estado === "reproduciendo").length,
    );
    try {
      await api.actualizarEstado(accessToken, id, "completada");
    } catch {
      setCola(previa);
      onCountChange?.(
        previa.filter((c) => c.estado === "pendiente" || c.estado === "reproduciendo").length,
      );
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
          {cola.map((c, idx) => {
            const conSaludo = Boolean(c.saludo?.trim());
            return (
              <div key={c.id} className={`cola-row ${c.estado}`}>
                <span className="cola-pos" aria-label={`Posición ${idx + 1}`}>
                  #{idx + 1}
                </span>
                <div className="cola-row-info">
                  <span className={`cola-estado ${c.estado}`}>
                    {c.estado === "reproduciendo" ? (
                      <><PlayIcon size={12} /> Sonando</>
                    ) : (
                      "En cola"
                    )}
                    {conSaludo && <span className="cola-saludo-badge">Saludo</span>}
                  </span>
                  <span className="cola-cancion">{c.titulo_cancion}</span>
                  <span className="cola-meta">
                    {c.nombre_cliente} · {c.etiqueta ?? `Mesa ${c.numero_mesa}`}
                    {" · "}
                    {textoEspera(c.creado_en, ahora)}
                  </span>
                </div>
                <button className="btn-secondary cola-quitar" onClick={() => quitar(c.id)}>
                  Quitar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
