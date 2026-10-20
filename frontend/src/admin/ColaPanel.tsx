import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import { api, supabase, metaCola, type ColaItem } from "@dcuerdas/shared";
import { PlayIcon } from "../cliente/components/Icons";
import { SkeletonRows, useEsqueletoSiDemora } from "../components/Skeleton";

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

function idsPendientes(lista: ColaItem[]): number[] {
  return lista.filter((c) => c.estado === "pendiente").map((c) => c.id);
}

type Slot = { top: number; height: number };

type Arrastre = {
  id: number;
  desde: number;
  hacia: number;
  delta: number;
  asentando: boolean;
};

function separacion(slots: Slot[]): number {
  if (slots.length < 2) return 8;
  return slots[1].top - slots[0].top - slots[0].height;
}

/** Cuánto debe bajar o subir cada canción para quedar en el hueco final, sin saltos. */
function desplazamiento(slots: Slot[], desde: number, hacia: number): number[] {
  const orden = slots.map((_, indice) => indice);
  const [movida] = orden.splice(desde, 1);
  orden.splice(hacia, 0, movida);
  const gap = separacion(slots);
  const delta = slots.map(() => 0);
  let y = slots[0]?.top ?? 0;
  for (let puesto = 0; puesto < orden.length; puesto++) {
    const origen = orden[puesto];
    delta[origen] = y - slots[origen].top;
    y += slots[origen].height + gap;
  }
  return delta;
}

function reordenarPorIndice(lista: ColaItem[], id: number, hacia: number): ColaItem[] {
  const sonando = lista.filter((c) => c.estado === "reproduciendo");
  const pendientes = lista.filter((c) => c.estado === "pendiente");
  const desde = pendientes.findIndex((c) => c.id === id);
  if (desde < 0 || desde === hacia || hacia < 0 || hacia >= pendientes.length) return lista;
  const siguiente = [...pendientes];
  const [item] = siguiente.splice(desde, 1);
  siguiente.splice(hacia, 0, item);
  const resto = lista.filter((c) => c.estado !== "pendiente" && c.estado !== "reproduciendo");
  return [...sonando, ...siguiente, ...resto];
}

function indicePorSlots(
  y: number,
  slots: { top: number; height: number }[],
): number {
  let indice = 0;
  for (let i = 0; i < slots.length; i++) {
    const medio = slots[i].top + slots[i].height / 2;
    if (y >= medio) indice = i;
  }
  return indice;
}

export function ColaPanel({ accessToken, onCountChange }: Props) {
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const esqueleto = useEsqueletoSiDemora(cargando && cola.length === 0);
  const [error, setError] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const [quieto, setQuieto] = useState(false);
  const arrastrandoRef = useRef(false);
  const arrastreRef = useRef<Arrastre | null>(null);
  const slotsRef = useRef<{ top: number; height: number }[]>([]);
  const inicioYRef = useRef(0);
  const colaRef = useRef(cola);
  const ordenInicialRef = useRef<number[]>([]);
  const revisionRef = useRef(0);
  const listaRef = useRef<HTMLDivElement>(null);
  colaRef.current = cola;

  const cargar = useCallback(async () => {
    if (arrastrandoRef.current) return;
    const revision = revisionRef.current;
    try {
      const data = await api.colaActiva(accessToken);
      if (arrastrandoRef.current || revisionRef.current !== revision) return;
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
    } finally {
      setCargando(false);
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

  const publicarArrastre = (siguiente: Arrastre | null) => {
    arrastreRef.current = siguiente;
    setArrastre(siguiente);
  };

  const empezarArrastre = (event: ReactPointerEvent<HTMLDivElement>, id: number) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const root = listaRef.current;
    if (!root) return;
    const filas = [...root.querySelectorAll<HTMLElement>(".cola-row.pendiente")];
    const desde = filas.findIndex((fila) => Number(fila.dataset.colaId) === id);
    if (desde < 0) return;
    event.preventDefault();
    slotsRef.current = filas.map((fila) => ({ top: fila.offsetTop, height: fila.offsetHeight }));
    inicioYRef.current = event.clientY;
    ordenInicialRef.current = idsPendientes(colaRef.current);
    arrastrandoRef.current = true;
    publicarArrastre({
      id,
      desde,
      hacia: desde,
      delta: 0,
      asentando: false,
    });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* El movimiento sigue llegando a la fila. */
    }
  };

  const seguirArrastre = (event: ReactPointerEvent<HTMLDivElement>) => {
    const actual = arrastreRef.current;
    const root = listaRef.current;
    if (!actual || actual.asentando || !root) return;
    const y = event.clientY - root.getBoundingClientRect().top + root.scrollTop;
    const hacia = indicePorSlots(y, slotsRef.current);
    const delta = event.clientY - inicioYRef.current;
    if (hacia === actual.hacia && delta === actual.delta) return;
    publicarArrastre({ ...actual, hacia, delta });
  };

  const soltarArrastre = async () => {
    const actual = arrastreRef.current;
    if (!actual || actual.asentando) return;
    if (actual.desde === actual.hacia) {
      arrastreRef.current = null;
      setArrastre(null);
      arrastrandoRef.current = false;
      return;
    }
    const meta = desplazamiento(slotsRef.current, actual.desde, actual.hacia)[actual.desde] ?? actual.delta;
    const fila = listaRef.current?.querySelector<HTMLElement>(`[data-cola-id="${actual.id}"]`);
    let animacion: Animation | null = null;
    if (fila && Math.abs(meta - actual.delta) > 0.5) {
      animacion = fila.animate(
        [{ transform: `translateY(${actual.delta}px)` }, { transform: `translateY(${meta}px)` }],
        { duration: 160, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
      );
      publicarArrastre({ ...actual, delta: meta, asentando: true });
      await Promise.race([
        animacion.finished.catch(() => undefined),
        new Promise((resolver) => window.setTimeout(resolver, 220)),
      ]);
      if (animacion.playState !== "finished") animacion.finish();
    }
    const siguiente = reordenarPorIndice(colaRef.current, actual.id, actual.hacia);
    const ids = idsPendientes(siguiente);
    const cambio = ids.join(",") !== ordenInicialRef.current.join(",");
    if (!cambio) {
      animacion?.cancel();
      arrastreRef.current = null;
      setArrastre(null);
      arrastrandoRef.current = false;
      return;
    }
    colaRef.current = siguiente;
    const miRevision = ++revisionRef.current;
    const root = listaRef.current;
    flushSync(() => setQuieto(true));
    root?.getBoundingClientRect();
    flushSync(() => {
      arrastreRef.current = null;
      setArrastre(null);
      setCola(siguiente);
    });
    animacion?.cancel();
    window.setTimeout(() => setQuieto(false), 50);
    try {
      await api.guardarOrdenCola(accessToken, ids);
      if (revisionRef.current !== miRevision) return;
      setError("");
    } catch {
      if (revisionRef.current !== miRevision) return;
      setError("No se pudo cambiar el orden");
      arrastrandoRef.current = false;
      await cargar();
      return;
    }
    if (revisionRef.current !== miRevision) return;
    arrastrandoRef.current = false;
  };

  const estiloArrastre = (indice: number): CSSProperties | undefined => {
    if (!arrastre || indice < 0 || slotsRef.current.length === 0) return undefined;
    const filaId = cola.filter((c) => c.estado === "pendiente")[indice]?.id;
    if (filaId === arrastre.id) return { transform: `translateY(${arrastre.delta}px)` };
    const delta = desplazamiento(slotsRef.current, arrastre.desde, arrastre.hacia)[indice] ?? 0;
    if (Math.abs(delta) < 0.5) return undefined;
    return { transform: `translateY(${delta}px)` };
  };

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
      {esqueleto ? (
        <SkeletonRows filas={5} conAvatar />
      ) : cargando && cola.length === 0 ? null : cola.length === 0 ? (
        <p className="panel-empty">Vacía</p>
      ) : (
        <div className={`cola-list${quieto ? " is-quiet" : ""}`} ref={listaRef}>
          {(() => {
            let pendiente = 0;
            return cola.map((c, idx) => {
            const conSaludo = Boolean(c.saludo?.trim());
            const seArrastra = c.estado === "pendiente";
            const indice = seArrastra ? pendiente++ : -1;
            return (
              <div
                key={c.id}
                data-cola-id={c.id}
                role="listitem"
                aria-label={seArrastra ? c.titulo_cancion : `Sonando ${c.titulo_cancion}`}
                className={`cola-row ${c.estado}${arrastre?.id === c.id ? " is-dragging" : ""}${arrastre?.id === c.id && arrastre.asentando ? " is-settling" : ""}`}
                style={estiloArrastre(indice)}
                onPointerDown={seArrastra ? (event) => empezarArrastre(event, c.id) : undefined}
                onPointerMove={seArrastra ? seguirArrastre : undefined}
                onPointerUp={seArrastra ? () => void soltarArrastre() : undefined}
                onPointerCancel={seArrastra ? () => void soltarArrastre() : undefined}
              >
                {seArrastra && <span className="cola-grip" aria-hidden="true" />}
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
                    {metaCola(c)}
                    {" · "}
                    {textoEspera(c.creado_en, ahora)}
                  </span>
                </div>
                <div className="cola-acciones">
                  <button type="button" className="btn-secondary cola-quitar" onClick={() => quitar(c.id)}>
                    Quitar
                  </button>
                </div>
              </div>
            );
            });
          })()}
        </div>
      )}
    </div>
  );
}
