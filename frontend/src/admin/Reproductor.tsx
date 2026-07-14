import { useCallback, useEffect, useRef, useState } from "react";
import { api, supabase, es, type ColaItem } from "@dcuerdas/shared";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { BrandLogo } from "../components/BrandLogo";
import { leerSaludo } from "./leerSaludo";

type Props = { readonly accessToken: string };

function decodeHtml(texto: string): string {
  const area = document.createElement("textarea");
  area.innerHTML = texto;
  return area.value;
}

/** Videos conocidos para la radio de la casa (nunca el último pedido del cliente). */
const RADIO_CASA = [
  "kJQP7kiw5Fk",
  "pRpeEdMmmQ0",
  "7zp1TbLFPp8",
  "kfVsfOSbJY0",
  "TmKh7lAwnBI",
  "OPf0YbXqDm0",
  "CevxZvSJLk8",
  "fJ9rUzIMcZQ",
  "hT_nvWreIhg",
  "09R8_2nJtjg",
  "2Vv-BfVoq4g",
  "YQHsXMglC9A",
];

export function Reproductor({ accessToken }: Props) {
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [actual, setActual] = useState<ColaItem | null>(null);
  const [mostrarSaludo, setMostrarSaludo] = useState(false);
  const [error, setError] = useState("");
  const [relleno, setRelleno] = useState(false);
  const procesandoRef = useRef(false);
  const actualRef = useRef<ColaItem | null>(null);
  actualRef.current = actual;
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const completadasRef = useRef<Set<number>>(new Set());
  const rellenoActivoRef = useRef(false);
  /** Evita reiniciar la radio en cada poll; se resetea al llegar un pedido. */
  const radioArrancadaRef = useRef(false);
  const playRef = useRef<(id: string) => void>(() => {});
  const playRadioRef = useRef<(ids: string[]) => void>(() => {});
  const setVolumeRef = useRef<(v: number) => void>(() => {});
  const getVolumeRef = useRef<() => number>(() => 100);
  const cancelarVozRef = useRef<() => void>(() => {});
  const saludoFinalPendienteRef = useRef(false);

  const cargarCola = useCallback(async () => {
    try {
      const data = await api.colaActiva(accessToken);
      if (Array.isArray(data)) setCola(data);
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }, [accessToken]);

  useEffect(() => {
    cargarCola();
    // Por si un HMR o sesión anterior dejó el anuncio pegado.
    setMostrarSaludo(false);
    const channel = supabase
      .channel("cola-reproductor")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cola_reproduccion" },
        () => cargarCola(),
      )
      .subscribe();
    const intervalo = window.setInterval(cargarCola, 5000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(intervalo);
      cancelarVozRef.current();
    };
  }, [cargarCola]);

  const iniciarRelleno = useCallback(() => {
    saludoFinalPendienteRef.current = false;
    cancelarVozRef.current();
    setMostrarSaludo(false);
    rellenoActivoRef.current = true;
    radioArrancadaRef.current = true;
    setRelleno(true);
    setActual(null);
    // Lista mezclada de la casa — no el video del cliente anterior.
    playRadioRef.current(RADIO_CASA);
  }, []);

  /** Overlay + voz solo si hay texto de saludo. */
  const presentarSaludo = useCallback((cancion: ColaItem, onListo?: () => void) => {
    cancelarVozRef.current();
    const texto = cancion.saludo?.trim();
    if (!texto) {
      setMostrarSaludo(false);
      onListo?.();
      return;
    }

    setMostrarSaludo(true);
    const volAntes = getVolumeRef.current();
    setVolumeRef.current(12);

    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      setVolumeRef.current(volAntes || 100);
      setMostrarSaludo(false);
      onListo?.();
    };

    const cancelarVoz = leerSaludo(texto, { onEnd: cerrar });
    const tope = window.setTimeout(cerrar, 18000);

    cancelarVozRef.current = () => {
      window.clearTimeout(tope);
      cancelarVoz();
      cerrar();
    };
  }, []);

  const iniciarCancion = useCallback(async (cancion: ColaItem) => {
    if (procesandoRef.current) return;
    procesandoRef.current = true;
    saludoFinalPendienteRef.current = false;
    try {
      const updated = await api.actualizarEstado(accessToken, cancion.id, "reproduciendo");
      const item: ColaItem = {
        ...cancion,
        ...updated,
        tipo: updated.tipo ?? cancion.tipo,
        etiqueta: updated.etiqueta ?? cancion.etiqueta,
        saludo_momento: updated.saludo_momento ?? cancion.saludo_momento ?? "inicio",
      };
      rellenoActivoRef.current = false;
      radioArrancadaRef.current = false;
      setRelleno(false);
      setActual(item);
      playRef.current(item.youtube_video_id);

      const momento = item.saludo?.trim() ? (item.saludo_momento ?? "inicio") : "inicio";
      if (item.saludo?.trim() && momento === "inicio") {
        presentarSaludo(item);
      } else {
        cancelarVozRef.current();
        setMostrarSaludo(false);
      }
    } catch {
      setError("Error al iniciar canción");
    } finally {
      procesandoRef.current = false;
    }
  }, [accessToken, presentarSaludo]);

  const completar = useCallback(async (id: number) => {
    saludoFinalPendienteRef.current = false;
    cancelarVozRef.current();
    setMostrarSaludo(false);
    completadasRef.current.add(id);
    setActual(null);
    setCola((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.actualizarEstado(accessToken, id, "completada");
    } catch {
      /* la recarga siguiente reconcilia el estado */
    }
    await cargarCola();
  }, [accessToken, cargarCola]);

  const onEnded = useCallback(() => {
    if (rellenoActivoRef.current) {
      // Con playlist en loop YouTube suele avanzar solo; si llega acá, mezclamos de nuevo.
      iniciarRelleno();
      return;
    }
    const current = actualRef.current;
    if (!current) {
      iniciarRelleno();
      return;
    }

    const momentoFinal =
      !!current.saludo?.trim() && (current.saludo_momento ?? "inicio") === "final";

    if (momentoFinal && !saludoFinalPendienteRef.current) {
      saludoFinalPendienteRef.current = true;
      presentarSaludo(current, () => {
        completar(current.id);
      });
      return;
    }
    completar(current.id);
  }, [completar, iniciarRelleno, presentarSaludo]);

  const onError = useCallback((code: number) => {
    if (rellenoActivoRef.current) {
      iniciarRelleno();
      return;
    }
    const current = actualRef.current;
    const bloqueado = code === 101 || code === 150;
    setError(
      bloqueado
        ? "Ese video no permite reproducirse fuera de YouTube. Saltando al siguiente..."
        : "No se pudo reproducir el video. Saltando al siguiente...",
    );
    if (current) completar(current.id);
    else iniciarRelleno();
    setTimeout(() => setError(""), 6000);
  }, [completar, iniciarRelleno]);

  const { ready, play, playRadio, setVolume, getVolume } = useYouTubePlayer(onEnded, onError);
  playRef.current = play;
  playRadioRef.current = playRadio;
  setVolumeRef.current = setVolume;
  getVolumeRef.current = getVolume;

  // Decide qué debe sonar: cola de clientes o radio aleatoria.
  useEffect(() => {
    if (!ready || procesandoRef.current) return;
    if (saludoFinalPendienteRef.current) return;

    const disponible = (c: ColaItem) => !completadasRef.current.has(c.id);
    const enCola = cola.filter(disponible);
    const reproduciendo = enCola.find((c) => c.estado === "reproduciendo");
    const pendiente = enCola.find((c) => c.estado === "pendiente");

    // Cola vacía: cortar canción del cliente y poner radio de la casa (una vez por vacío).
    if (enCola.length === 0) {
      if (actual) {
        cancelarVozRef.current();
        setMostrarSaludo(false);
        setActual(null);
      }
      if (!radioArrancadaRef.current) {
        iniciarRelleno();
      }
      return;
    }

    radioArrancadaRef.current = false;

    // Canción local que ya no está en la cola del servidor.
    if (actual && !enCola.some((c) => c.id === actual.id)) {
      cancelarVozRef.current();
      setMostrarSaludo(false);
      setActual(null);
      return; // el siguiente ciclo elige pendiente o radio
    }

    if (actual) return;

    if (reproduciendo) {
      rellenoActivoRef.current = false;
      radioArrancadaRef.current = false;
      setRelleno(false);
      cancelarVozRef.current();
      setMostrarSaludo(false);
      setActual(reproduciendo);
      playRef.current(reproduciendo.youtube_video_id);
      return;
    }

    if (pendiente) {
      iniciarCancion(pendiente);
      return;
    }
  }, [ready, cola, actual, iniciarCancion, iniciarRelleno]);

  const proximas = cola.filter((c) => c.estado === "pendiente");

  const saltar = () => {
    cancelarVozRef.current();
    setMostrarSaludo(false);
    saludoFinalPendienteRef.current = false;
    const current = actualRef.current;
    if (current) {
      completar(current.id);
      return;
    }
    if (rellenoActivoRef.current || relleno) {
      iniciarRelleno();
    }
  };

  const entrarFullscreen = () => {
    contenedorRef.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="reproductor-wrap">
      <div className="reproductor-controles">
        <div className="rc-botones">
          <button
            onClick={saltar}
            disabled={!actual && !relleno}
            className="btn-secondary rc-btn"
          >
            Saltar
          </button>
          <button onClick={entrarFullscreen} className="btn-primary rc-btn">
            Pantalla completa
          </button>
        </div>
      </div>

      <div className="pantalla" ref={contenedorRef}>
        {error && <div className="error-bar">{error}</div>}

        <div className="player-wrap" style={{ visibility: actual || relleno ? "visible" : "hidden" }}>
          <div id="yt-player" />
        </div>

        {!actual && !relleno && (
          <div className="idle">
            <BrandLogo size="hero" className="idle-logo" />
            <p className="lema">{es.marca.lema}</p>
          </div>
        )}

        {relleno && !actual && (
          <div className="radio-badge">
            <span className="radio-badge-punto" />
            <div className="radio-badge-texto">
              <span className="radio-badge-titulo">{es.pantalla.radio}</span>
            </div>
          </div>
        )}

        {mostrarSaludo && actual?.saludo?.trim() && (
          <div className="overlay-saludo" aria-live="polite">
            <div className="overlay-titulo">
              {actual.tipo === "karaoke" ? es.pantalla.cantando : es.pantalla.suena}
            </div>
            <div className="overlay-nombre">{actual.nombre_cliente}</div>
            <div className="overlay-mesa">
              {actual.etiqueta ?? `${es.pantalla.deMesa} ${actual.numero_mesa}`}
            </div>
            <div className="overlay-saludo-text">&ldquo;{actual.saludo.trim()}&rdquo;</div>
          </div>
        )}

        {actual && (
          <div className="now-playing-bar">
            <span className="np-label">{actual.tipo === "karaoke" ? es.pantalla.cantando : es.pantalla.suena}:</span>
            <span className="np-nombre">{actual.nombre_cliente}</span>
            <span className="np-mesa">— {actual.etiqueta ?? `Mesa ${actual.numero_mesa}`}</span>
          </div>
        )}

        {proximas.length > 0 && (
          <div className="proximas">
            <div className="proximas-titulo">{es.pantalla.proximo}</div>
            {proximas.slice(0, 3).map((c, i) => (
              <div key={c.id} className="proxima-item">
                <span className="proxima-num">{i + 1}</span>
                <div className="proxima-datos">
                  <div className="proxima-cliente">
                    <span className="proxima-nombre">{c.nombre_cliente}</span>
                    <span className="proxima-mesa">{c.etiqueta ?? `Mesa ${c.numero_mesa}`}</span>
                  </div>
                  {c.titulo_cancion && (
                    <span className="proxima-cancion">{decodeHtml(c.titulo_cancion)}</span>
                  )}
                  {c.saludo && (
                    <span className="proxima-saludo">
                      Saludo {c.saludo_momento === "final" ? "al final" : "al inicio"}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {proximas.length > 3 && (
              <div className="proximas-mas">+{proximas.length - 3} más en cola</div>
            )}
          </div>
        )}

        <div className="watermark">
          <BrandLogo size="nav" />
        </div>
      </div>
    </div>
  );
}
