import { useCallback, useEffect, useState } from "react";
import { api, supabase, type ColaItem } from "@dcuerdas/shared";
import { abrirReproductorVentana } from "./abrirReproductorVentana";
import {
  estaPlayingEnVivo,
  miniaturaYoutube,
  suscribirNowPlaying,
  type NowPlayingPayload,
} from "./nowPlayingChannel";

const DISMISS_KEY = "dc-repro-bubble-dismissed";

type Props = {
  readonly accessToken: string;
  readonly onPlayingChange?: (playing: boolean) => void;
};

/** Por si en algún momento se ocultó: vuelve a mostrar el círculo. */
export function mostrarReproductorBubble(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("dc-repro-bubble-show"));
}

/**
 * Burbuja flotante: abre el reproductor en otra pestaña.
 * Tras F5 siempre aparece. La X solo la oculta hasta recargar.
 */
export function ReproductorBubble({ accessToken, onPlayingChange }: Props) {
  const [oculto, setOculto] = useState(false);
  const [now, setNow] = useState<NowPlayingPayload | null>(null);
  const sonando = estaPlayingEnVivo(now);

  const aplicarBroadcast = useCallback(
    (payload: NowPlayingPayload) => {
      setNow(payload);
      onPlayingChange?.(estaPlayingEnVivo(payload));
    },
    [onPlayingChange],
  );

  const cargarDesdeCola = useCallback(async () => {
    try {
      const data = await api.colaActiva(accessToken);
      if (!Array.isArray(data)) return;
      const actual =
        data.find((c: ColaItem) => c.estado === "reproduciendo") ??
        data.find((c: ColaItem) => c.estado === "pendiente") ??
        null;
      if (!actual) {
        setNow((prev) => (estaPlayingEnVivo(prev) ? prev : null));
        return;
      }
      setNow((prev) => ({
        playing: estaPlayingEnVivo(prev),
        ts: prev?.ts,
        youtube_video_id: actual.youtube_video_id,
        titulo: actual.titulo_cancion,
        nombre_cliente: actual.nombre_cliente,
        numero_mesa: actual.numero_mesa,
        esAmbiente: false,
      }));
    } catch {
      /* silencioso */
    }
  }, [accessToken]);

  useEffect(() => {
    // Limpia dismiss viejo que hacía desaparecer el círculo tras F5.
    try {
      localStorage.removeItem(DISMISS_KEY);
      sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      /* ignore */
    }
    setOculto(false);

    const onShow = () => setOculto(false);
    window.addEventListener("dc-repro-bubble-show", onShow);
    return () => window.removeEventListener("dc-repro-bubble-show", onShow);
  }, []);

  useEffect(() => {
    const unsub = suscribirNowPlaying(aplicarBroadcast);
    cargarDesdeCola();
    const ch = supabase
      .channel("bubble-cola")
      .on("postgres_changes", { event: "*", schema: "public", table: "cola_reproduccion" }, () => {
        cargarDesdeCola();
      })
      .subscribe();
    return () => {
      unsub();
      supabase.removeChannel(ch);
      onPlayingChange?.(false);
    };
  }, [aplicarBroadcast, cargarDesdeCola, onPlayingChange]);

  useEffect(() => {
    const id = window.setInterval(() => {
      onPlayingChange?.(estaPlayingEnVivo(now));
      if (now?.playing && !estaPlayingEnVivo(now)) {
        setNow((prev) => (prev ? { ...prev, playing: false } : prev));
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [now, onPlayingChange]);

  if (oculto) return null;

  const thumb = miniaturaYoutube(now?.youtube_video_id);
  const titulo = now?.titulo?.trim() || "Reproductor";

  return (
    <div className={`repro-bubble${sonando ? " is-playing" : ""}`}>
      <span className="repro-bubble-ring repro-bubble-ring--1" aria-hidden />
      <span className="repro-bubble-ring repro-bubble-ring--2" aria-hidden />
      <span className="repro-bubble-ring repro-bubble-ring--3" aria-hidden />
      <button
        type="button"
        className="repro-bubble-close"
        aria-label="Ocultar acceso al reproductor"
        onClick={() => setOculto(true)}
      >
        ×
      </button>
      <button
        type="button"
        className="repro-bubble-btn"
        title={titulo}
        aria-label={`Abrir reproductor: ${titulo}`}
        onClick={() => abrirReproductorVentana()}
      >
        {thumb ? (
          <img src={thumb} alt="" className="repro-bubble-img" />
        ) : (
          <span className="repro-bubble-fallback" aria-hidden>
            ▶
          </span>
        )}
      </button>
    </div>
  );
}
