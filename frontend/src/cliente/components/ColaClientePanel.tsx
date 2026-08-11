import { es } from "@dcuerdas/shared";
import { ClockIcon, PlayIcon } from "./Icons";

export type ColaPublicaItem = {
  id: number;
  numero_mesa: number;
  etiqueta: string | null;
  tipo?: string;
  titulo_cancion: string;
  nombre_cliente: string;
  estado: string;
};

type Props = {
  cola: ColaPublicaItem[];
  numeroMesa: number;
  /** Solo ahora suena + tu posición (sin listas repetidas). */
  compacto?: boolean;
};

export function etiquetaMesa(
  item: Pick<ColaPublicaItem, "numero_mesa" | "etiqueta" | "tipo">,
): string {
  if (item.tipo === "local" || item.etiqueta === "Local") return "Local";
  return item.etiqueta ?? `Mesa ${item.numero_mesa}`;
}

export function mensajeAntes(antesDeTi: number, estado: string): string {
  if (estado === "reproduciendo") return es.cola.sonandoAhora;
  if (antesDeTi === 0) return es.cola.siguiente;
  if (antesDeTi === 1) return es.cola.unaAntes;
  return es.cola.variasAntes.replace("{n}", String(antesDeTi));
}

export function ColaClientePanel({ cola, numeroMesa, compacto }: Props) {
  const ahoraSuena = cola.find((c) => c.estado === "reproduciendo") ?? null;
  const misIndices = cola
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.numero_mesa === numeroMesa);

  if (misIndices.length === 0 && !ahoraSuena) return null;

  const proximaMia = misIndices.find(({ c }) => c.estado === "pendiente" || c.estado === "reproduciendo");
  const idxMia = proximaMia?.i ?? -1;

  // Vista mínima: una sola tarjeta con lo esencial.
  if (compacto) {
    return (
      <div className="cola-panel cola-panel--compact">
        {ahoraSuena && (
          <div className="cola-linea">
            <PlayIcon size={14} />
            <div className="cola-linea-texto">
              <span className="cola-linea-label">{es.cola.ahoraSuena}</span>
              <span className="cola-linea-titulo">{ahoraSuena.titulo_cancion}</span>
            </div>
          </div>
        )}
        {proximaMia && proximaMia.c.estado !== "reproduciendo" && (
          <div className="cola-linea cola-linea--tu">
            <ClockIcon size={14} />
            <div className="cola-linea-texto">
              <span className="cola-linea-label">
                #{idxMia + 1} · {mensajeAntes(idxMia, proximaMia.c.estado)}
              </span>
              <span className="cola-linea-titulo">{proximaMia.c.titulo_cancion}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cola-panel">
      {ahoraSuena && (
        <div className="cola-ahora">
          <div className="cola-ahora-label">
            <PlayIcon size={14} />
            {es.cola.ahoraSuena}
          </div>
          <div className="cola-ahora-titulo">{ahoraSuena.titulo_cancion}</div>
          <div className="cola-ahora-meta">
            {ahoraSuena.nombre_cliente} · {etiquetaMesa(ahoraSuena)}
          </div>
        </div>
      )}

      {proximaMia && proximaMia.c.estado !== "reproduciendo" && (
        <div className="cola-tu-turno">
          <div className="cola-tu-turno-head">
            <ClockIcon size={16} />
            <span>{mensajeAntes(idxMia, proximaMia.c.estado)}</span>
          </div>
          <div className="cola-tu-turno-pos">
            {es.cola.posicion} <strong>#{idxMia + 1}</strong>
            <span className="cola-total">
              {es.cola.enColaTotal.replace("{n}", String(cola.length))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
