import { useCallback, useEffect, useRef, useState } from "react";
import { api, supabase, es, type ColaItem } from "@dcuerdas/shared";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { BrandLogo } from "../components/BrandLogo";
import { leerSaludo } from "./leerSaludo";
import { AdminBuscadorMusica } from "./AdminBuscadorMusica";

type Props = {
  readonly accessToken: string;
  readonly visible?: boolean;
  readonly onPlayingChange?: (playing: boolean) => void;
};

function decodeHtml(texto: string): string {
  const area = document.createElement("textarea");
  area.innerHTML = texto;
  return area.value;
}

/** Ambiente = canciones ENVIADAS (BD). YouTube a veces bloquea embed → saltamos a otra. */
const ERROR_GRACE_MS = 0;
const RADIO_WATCHDOG_MS = 3000;
const COLA_WATCHDOG_MS = 4500;

function elegirAlAzar(
  pool: string[],
  excluir: Iterable<string>,
  preferidas?: Set<string>,
): string | null {
  const ban = new Set(excluir);
  const libres = pool.filter((id) => !ban.has(id));
  if (libres.length === 0) return null;
  const buenos =
    preferidas && preferidas.size > 0
      ? libres.filter((id) => preferidas.has(id))
      : [];
  const candidatos = buenos.length > 0 ? buenos : libres;
  return candidatos[Math.floor(Math.random() * candidatos.length)];
}

export function Reproductor({ accessToken, visible = true, onPlayingChange }: Props) {
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [actual, setActual] = useState<ColaItem | null>(null);
  const [mostrarSaludo, setMostrarSaludo] = useState(false);
  const [error, setError] = useState("");
  const [relleno, setRelleno] = useState(false);
  const [poolVersion, setPoolVersion] = useState(0);
  const [tituloAmbiente, setTituloAmbiente] = useState("");
  const [poolSize, setPoolSize] = useState(0);

  const procesandoRef = useRef(false);
  const actualRef = useRef<ColaItem | null>(null);
  actualRef.current = actual;
  const colaRef = useRef<ColaItem[]>([]);
  colaRef.current = cola;
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const completadasRef = useRef<Set<number>>(new Set());
  const rellenoActivoRef = useRef(false);
  const radioArrancadaRef = useRef(false);
  const bloqueadosRadioRef = useRef<Set<string>>(new Set());
  const videoActualRadioRef = useRef<string | null>(null);
  const ignoreErrorUntilRef = useRef(0);
  const radioWatchdogRef = useRef<number | undefined>(undefined);
  const titulosPoolRef = useRef<Map<string, string>>(new Map());
  const poolRadioRef = useRef<string[]>([]);
  const preferidasRef = useRef<Set<string>>(new Set());
  const playRef = useRef<(id: string) => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});
  const setVolumeRef = useRef<(v: number) => void>(() => {});
  const getVolumeRef = useRef<() => number>(() => 100);
  const cancelarVozRef = useRef<() => void>(() => {});
  const saludoFinalPendienteRef = useRef(false);
  const pausaUsuarioRef = useRef(false);
  const visibleAntesRef = useRef(false);
  /** Solo true después de abrir la pestaña Reproductor al menos una vez. */
  const sesionActivaRef = useRef(false);
  const radioErrorLockRef = useRef(false);
  const iniciarRellenoRef = useRef<() => void>(() => {});
  const completarRef = useRef<(id: number) => void>(() => {});
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;
  const hayPedidoEnCola = () =>
    colaRef.current.some(
      (c) =>
        !completadasRef.current.has(c.id) &&
        (c.estado === "pendiente" || c.estado === "reproduciendo"),
    );

  const clearRadioWatchdog = useCallback(() => {
    if (radioWatchdogRef.current) {
      window.clearTimeout(radioWatchdogRef.current);
      radioWatchdogRef.current = undefined;
    }
  }, []);

  const playVideo = useCallback((videoId: string, comoRadio = false) => {
    ignoreErrorUntilRef.current = Date.now() + ERROR_GRACE_MS;
    playRef.current(videoId);
    clearRadioWatchdog();
    const esperado = videoId;
    radioWatchdogRef.current = window.setTimeout(() => {
      if (comoRadio) {
        if (!rellenoActivoRef.current) return;
        if (videoActualRadioRef.current !== esperado) return;
        bloqueadosRadioRef.current.add(esperado);
        api.marcarYoutubeBloqueado(accessTokenRef.current, esperado, "watchdog_radio").catch(() => {});
        radioErrorLockRef.current = false;
        setError("YouTube no dejó reproducir ese video. Probando otro del historial…");
        iniciarRellenoRef.current();
        return;
      }
      const actual = actualRef.current;
      if (!actual || actual.youtube_video_id !== esperado) return;
      if (rellenoActivoRef.current) return;
      api.marcarYoutubeBloqueado(accessTokenRef.current, esperado, "watchdog_cola").catch(() => {});
      setError("YouTube bloqueó este video. Saltando…");
      completarRef.current(actual.id);
    }, comoRadio ? RADIO_WATCHDOG_MS : COLA_WATCHDOG_MS);
  }, [clearRadioWatchdog]);

  const agregarAlPool = useCallback((videoId: string, titulo?: string) => {
    if (!videoId || videoId.length < 6) return;
    if (titulo) titulosPoolRef.current.set(videoId, titulo);
    if (!poolRadioRef.current.includes(videoId)) {
      poolRadioRef.current = [videoId, ...poolRadioRef.current];
    }
  }, []);

  const cargarCola = useCallback(async () => {
    try {
      const data = await api.colaActiva(accessToken);
      if (Array.isArray(data)) setCola(data);
      else setError("No se pudo leer la cola");
    } catch {
      setError("No se pudo conectar con el servidor");
    }
  }, [accessToken]);

  const cargarPoolRadio = useCallback(async () => {
    try {
      const res = await api.radioCasa(accessToken);
      const mapa = new Map<string, string>();
      const preferidas = new Set<string>();
      const ids: string[] = [];
      for (const v of res.videos ?? []) {
        if (typeof v.video_id !== "string" || v.video_id.length < 6) continue;
        if (ids.includes(v.video_id)) continue;
        ids.push(v.video_id);
        mapa.set(v.video_id, v.titulo || "");
        if (v.preferida) preferidas.add(v.video_id);
      }
      poolRadioRef.current = ids;
      preferidasRef.current = preferidas;
      titulosPoolRef.current = mapa;
      setPoolSize(ids.length);
      setPoolVersion((n) => n + 1);
      return ids.length;
    } catch {
      poolRadioRef.current = [];
      preferidasRef.current = new Set();
      titulosPoolRef.current = new Map();
      setPoolSize(0);
      setPoolVersion((n) => n + 1);
      return 0;
    }
  }, [accessToken]);

  useEffect(() => {
    cargarCola();
    cargarPoolRadio();
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
      clearRadioWatchdog();
    };
  }, [cargarCola, cargarPoolRadio, clearRadioWatchdog]);

  const detenerRadio = useCallback((mensaje?: string) => {
    clearRadioWatchdog();
    radioErrorLockRef.current = true;
    rellenoActivoRef.current = false;
    radioArrancadaRef.current = true;
    videoActualRadioRef.current = null;
    setRelleno(false);
    setTituloAmbiente("");
    setError(mensaje ?? "");
  }, [clearRadioWatchdog]);

  const iniciarRelleno = useCallback(() => {
    if (procesandoRef.current) return;
    if (hayPedidoEnCola()) return;
    if (actualRef.current) return;

    saludoFinalPendienteRef.current = false;
    pausaUsuarioRef.current = false;
    radioErrorLockRef.current = false;
    cancelarVozRef.current();
    setMostrarSaludo(false);

    const pool = poolRadioRef.current;
    if (pool.length === 0) {
      detenerRadio("Sin canciones enviadas para el ambiente.");
      return;
    }

    let id = elegirAlAzar(
      pool,
      [
        ...bloqueadosRadioRef.current,
        ...(videoActualRadioRef.current ? [videoActualRadioRef.current] : []),
      ],
      preferidasRef.current,
    );
    if (!id) id = elegirAlAzar(pool, bloqueadosRadioRef.current, preferidasRef.current);
    if (!id && bloqueadosRadioRef.current.size > 0) {
      // Si casi todos fallaron por embed, reintentar el pool limpio una vez.
      const sinActual = videoActualRadioRef.current;
      bloqueadosRadioRef.current.clear();
      id = elegirAlAzar(pool, sinActual ? [sinActual] : [], preferidasRef.current);
    }
    if (!id) {
      detenerRadio(
        "YouTube bloqueó los videos del historial (no permiten embeber). Pide letra/karaoke desde una mesa.",
      );
      return;
    }

    rellenoActivoRef.current = true;
    radioArrancadaRef.current = true;
    setRelleno(true);
    setActual(null);
    setTituloAmbiente(titulosPoolRef.current.get(id) ?? "");
    videoActualRadioRef.current = id;
    playVideo(id, true);
  }, [detenerRadio, playVideo]);

  iniciarRellenoRef.current = iniciarRelleno;

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
    // Bajar casi al mínimo la música para que el saludo se oiga fuerte.
    setVolumeRef.current(2);
    let cerrado = false;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      setVolumeRef.current(volAntes || 100);
      setMostrarSaludo(false);
      onListo?.();
    };
    const cancelarVoz = leerSaludo(texto, { onEnd: cerrar });
    // Dos lecturas del saludo: margen amplio por si el texto es largo.
    const tope = window.setTimeout(cerrar, 56000);
    cancelarVozRef.current = () => {
      window.clearTimeout(tope);
      cancelarVoz();
      cerrar();
    };
  }, []);

  const iniciarCancion = useCallback(async (cancion: ColaItem) => {
    if (procesandoRef.current) return;
    if (actualRef.current?.id === cancion.id) return;

    procesandoRef.current = true;
    saludoFinalPendienteRef.current = false;
    rellenoActivoRef.current = false;
    radioArrancadaRef.current = false;
    pausaUsuarioRef.current = false;
    radioErrorLockRef.current = false;
    videoActualRadioRef.current = null;
    clearRadioWatchdog();
    cancelarVozRef.current();
    setMostrarSaludo(false);
    setRelleno(false);
    setError("");
    setTituloAmbiente("");

    try {
      const updated = await api.actualizarEstado(accessToken, cancion.id, "reproduciendo");
      if (completadasRef.current.has(cancion.id)) return;
      const item: ColaItem = {
        ...cancion,
        ...updated,
        tipo: updated.tipo ?? cancion.tipo,
        etiqueta: updated.etiqueta ?? cancion.etiqueta,
        saludo_momento: updated.saludo_momento ?? cancion.saludo_momento ?? "inicio",
      };
      setActual(item);
      playVideo(item.youtube_video_id, false);
      const momento = item.saludo?.trim() ? (item.saludo_momento ?? "inicio") : "inicio";
      if (item.saludo?.trim() && momento === "inicio") presentarSaludo(item);
    } catch {
      setError("Error al iniciar canción de la mesa");
      if (!hayPedidoEnCola()) {
        radioArrancadaRef.current = false;
        iniciarRelleno();
      }
    } finally {
      procesandoRef.current = false;
    }
  }, [accessToken, presentarSaludo, iniciarRelleno, playVideo, clearRadioWatchdog]);

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
      /* ignore */
    }
    await cargarCola();
  }, [accessToken, cargarCola]);

  completarRef.current = completar;

  const onEnded = useCallback(() => {
    if (procesandoRef.current) return;
    if (radioErrorLockRef.current) return;
    if (rellenoActivoRef.current) {
      if (!hayPedidoEnCola()) iniciarRelleno();
      return;
    }
    const current = actualRef.current;
    if (!current) {
      if (!hayPedidoEnCola()) iniciarRelleno();
      return;
    }
    const momentoFinal =
      !!current.saludo?.trim() && (current.saludo_momento ?? "inicio") === "final";
    if (momentoFinal && !saludoFinalPendienteRef.current) {
      saludoFinalPendienteRef.current = true;
      presentarSaludo(current, () => completar(current.id));
      return;
    }
    completar(current.id);
  }, [completar, iniciarRelleno, presentarSaludo]);

  const onError = useCallback((_code: number) => {
    if (procesandoRef.current) return;
    if (radioErrorLockRef.current) return;
    if (Date.now() < ignoreErrorUntilRef.current) return;

    if (!rellenoActivoRef.current) {
      const current = actualRef.current;
      const maloId = current?.youtube_video_id;
      if (maloId) {
        api.marcarYoutubeBloqueado(accessToken, maloId, "player_error_cola").catch(() => {});
      }
      setError("YouTube no permite este video fuera de youtube.com. Saltando…");
      if (current) completar(current.id);
      else if (!hayPedidoEnCola()) iniciarRelleno();
      return;
    }

    const malo = videoActualRadioRef.current;
    if (malo) {
      bloqueadosRadioRef.current.add(malo);
      api.marcarYoutubeBloqueado(accessToken, malo, "player_error_radio").catch(() => {});
    }
    clearRadioWatchdog();
    if (hayPedidoEnCola()) {
      detenerRadio();
      return;
    }
    setError("YouTube bloqueó ese video (no embebe). Probando otro del historial…");
    radioErrorLockRef.current = false;
    iniciarRelleno();
  }, [completar, iniciarRelleno, detenerRadio, clearRadioWatchdog, accessToken]);

  const handlePlayingChange = useCallback((playing: boolean) => {
    if (playing) {
      pausaUsuarioRef.current = false;
      radioErrorLockRef.current = false;
      clearRadioWatchdog();
      setError("");
      const mesa = actualRef.current;
      if (mesa?.youtube_video_id) agregarAlPool(mesa.youtube_video_id, mesa.titulo_cancion);
    } else if (!rellenoActivoRef.current) {
      pausaUsuarioRef.current = true;
    }
    onPlayingChange?.(playing);
  }, [onPlayingChange, agregarAlPool, clearRadioWatchdog]);

  const { ready, play, resume, setVolume, getVolume } = useYouTubePlayer(
    onEnded,
    onError,
    handlePlayingChange,
  );
  playRef.current = play;
  resumeRef.current = resume;
  setVolumeRef.current = setVolume;
  getVolumeRef.current = getVolume;

  useEffect(() => {
    // No arrancar audio hasta que el admin abra la pestaña Reproductor.
    if (!sesionActivaRef.current) return;
    if (!ready || procesandoRef.current) return;
    if (saludoFinalPendienteRef.current) return;

    const enCola = cola.filter((c) => !completadasRef.current.has(c.id));
    const reproduciendo = enCola.find((c) => c.estado === "reproduciendo");
    const pendiente = enCola.find((c) => c.estado === "pendiente");

    if (enCola.length === 0) {
      if (actual) {
        cancelarVozRef.current();
        setMostrarSaludo(false);
        setActual(null);
      }
      if (poolVersion === 0) return;
      if (!radioArrancadaRef.current) iniciarRelleno();
      return;
    }

    radioArrancadaRef.current = false;
    rellenoActivoRef.current = false;

    if (actual && !enCola.some((c) => c.id === actual.id)) {
      cancelarVozRef.current();
      setMostrarSaludo(false);
      setActual(null);
      if (reproduciendo) {
        setRelleno(false);
        setActual(reproduciendo);
        pausaUsuarioRef.current = false;
        playVideo(reproduciendo.youtube_video_id, false);
        return;
      }
      if (pendiente) {
        iniciarCancion(pendiente);
        return;
      }
      return;
    }

    if (actual && (reproduciendo?.id === actual.id || pendiente?.id === actual.id)) return;

    if (reproduciendo && actual?.id !== reproduciendo.id) {
      setRelleno(false);
      cancelarVozRef.current();
      setMostrarSaludo(false);
      pausaUsuarioRef.current = false;
      setActual(reproduciendo);
      playVideo(reproduciendo.youtube_video_id, false);
      return;
    }

    if (!actual && pendiente) iniciarCancion(pendiente);
  }, [ready, cola, actual, iniciarCancion, iniciarRelleno, playVideo, poolVersion, visible]);

  // Al cargar el pool: solo ambientar si ya se abrió Reproductor.
  useEffect(() => {
    if (!sesionActivaRef.current) return;
    if (!ready || poolVersion === 0) return;
    if (hayPedidoEnCola() || actualRef.current) return;
    if (rellenoActivoRef.current) return;
    radioArrancadaRef.current = false;
    iniciarRelleno();
  }, [poolVersion, ready, iniciarRelleno, visible]);

  // Arranque real: solo al estar en la pestaña Reproductor Y con el player listo.
  useEffect(() => {
    if (!visible) {
      visibleAntesRef.current = false;
      return;
    }
    if (!ready) return; // no marcar como "ya abierto" hasta que el player exista

    const acabaDeAbrir = !visibleAntesRef.current;
    visibleAntesRef.current = true;
    sesionActivaRef.current = true;

    if (!acabaDeAbrir) {
      if (rellenoActivoRef.current && !pausaUsuarioRef.current) resumeRef.current();
      return;
    }

    // Primera vez (o reentrada) en Reproductor: asegurar pool y arrancar.
    void (async () => {
      if (hayPedidoEnCola()) return; // el efecto de cola toma el pedido
      if (poolRadioRef.current.length === 0) {
        await cargarPoolRadio();
      }
      if (hayPedidoEnCola() || actualRef.current) return;
      if (!rellenoActivoRef.current) {
        radioArrancadaRef.current = false;
        iniciarRelleno();
      } else if (!pausaUsuarioRef.current) {
        resumeRef.current();
      }
    })();
  }, [visible, ready, iniciarRelleno, cargarPoolRadio]);

  const proximas = cola.filter((c) => c.estado === "pendiente");

  const saltar = async () => {
    cancelarVozRef.current();
    setMostrarSaludo(false);
    saludoFinalPendienteRef.current = false;
    pausaUsuarioRef.current = false;
    radioErrorLockRef.current = false;
    ignoreErrorUntilRef.current = 0;
    clearRadioWatchdog();
    setError("");

    const current = actualRef.current;
    if (current) {
      completar(current.id);
      return;
    }

    if (hayPedidoEnCola()) {
      const pendiente = colaRef.current.find(
        (c) => !completadasRef.current.has(c.id) && c.estado === "pendiente",
      );
      if (pendiente) {
        iniciarCancion(pendiente);
        return;
      }
      const enCurso = colaRef.current.find(
        (c) => !completadasRef.current.has(c.id) && c.estado === "reproduciendo",
      );
      if (enCurso) {
        completar(enCurso.id);
        return;
      }
    }

    const actualRadio = videoActualRadioRef.current;
    if (actualRadio) bloqueadosRadioRef.current.add(actualRadio);
    if (poolRadioRef.current.length === 0) await cargarPoolRadio();

    radioArrancadaRef.current = false;
    iniciarRelleno();
  };

  const puedeSaltar = !!actual || relleno || hayPedidoEnCola() || !!error;

  return (
    <div className="reproductor-wrap">
      <div className="reproductor-controles">
        <div className="rc-botones">
          <button onClick={saltar} disabled={!puedeSaltar} className="btn-secondary rc-btn">
            Saltar
          </button>
          <button
            onClick={() => contenedorRef.current?.requestFullscreen?.().catch(() => {})}
            className="btn-primary rc-btn"
          >
            Pantalla completa
          </button>
          {visible && <AdminBuscadorMusica accessToken={accessToken} />}
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
            {error ? null : (
              <p className="idle-hint">
                {poolVersion === 0
                  ? "Cargando ambiente…"
                  : poolSize === 0
                    ? "Sin canciones enviadas aún."
                    : `Ambiente: ${poolSize} canciones.`}
              </p>
            )}
          </div>
        )}

        {relleno && !actual && (
          <div className="radio-badge">
            <span className="radio-badge-punto" />
            <div className="radio-badge-texto">
              <span className="radio-badge-titulo">{es.pantalla.radio}</span>
              {tituloAmbiente && (
                <span className="radio-badge-sub" title={tituloAmbiente}>{tituloAmbiente}</span>
              )}
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
            <span className="np-label">
              {actual.tipo === "karaoke" ? es.pantalla.cantando : es.pantalla.suena}:
            </span>
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
