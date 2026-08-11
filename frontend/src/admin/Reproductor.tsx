import { useCallback, useEffect, useRef, useState } from "react";
import { api, supabase, es, zonaCola, type ColaItem } from "@dcuerdas/shared";
import { useYouTubePlayer } from "./useYouTubePlayer";
import { BrandLogo } from "../components/BrandLogo";
import { leerSaludo } from "./leerSaludo";
import { AdminBuscadorMusica } from "./AdminBuscadorMusica";
import {
  ANUNCIO_CONFIG_EVENT,
  ANUNCIO_PLAY_NOW_EVENT,
  leerAnuncioConfig,
  type AnuncioConfig,
} from "./anuncioConfig";
import { payloadDesdeCola, publicarNowPlaying, iniciarHeartbeatNowPlaying } from "./nowPlayingChannel";
import {
  guardarPosicionRepro,
  consumirPosicionTrasRecarga,
  marcarReanudarTrasRecarga,
  limpiarPosicionRepro,
} from "./reproPosicion";
import {
  REPRO_CMD_CHANNEL,
  consumirUnlockAudioReciente,
} from "./abrirReproductorVentana";

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

function textoIdleAmbiente(poolVersion: number, poolSize: number): string {
  if (poolVersion === 0) return "Cargando ambiente…";
  if (poolSize === 0) return "Sin canciones enviadas aún.";
  return `Ambiente: ${poolSize} canciones.`;
}

/**
 * Ambiente: tapa hasta PLAYING real (no destapar a ciegas → se veía “no disponible”).
 * Saltar con lock: varios clics seguidos no lanzan carreras.
 */
const ERROR_GRACE_MS = 900;
const RADIO_WATCHDOG_MS = 3200;
/** Cola: más margen; buffering lento no debe marcar la canción como completada. */
const COLA_WATCHDOG_MS = 12_000;
const COLA_WATCHDOG_EXTRA_MS = 10_000;
const RADIO_RETRY_MS = 5000;

function aleatorioEntero(maxExclusivo: number): number {
  if (maxExclusivo <= 1) return 0;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusivo;
}

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
  return candidatos[aleatorioEntero(candidatos.length)];
}

export function Reproductor({ accessToken, visible = true, onPlayingChange }: Props) {
  const [cola, setCola] = useState<ColaItem[]>([]);
  const [actual, setActual] = useState<ColaItem | null>(null);
  const [mostrarSaludo, setMostrarSaludo] = useState(false);
  const [error, setError] = useState("");
  const [relleno, setRelleno] = useState(false);
  /** Tapa el iframe mientras arranca ambiente (evita “no disponible” a la vista). */
  const [radioCubierto, setRadioCubierto] = useState(false);
  const [saltandoUi, setSaltandoUi] = useState(false);
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
  /** Solo true cuando YouTube reporta PLAYING real. */
  const ytPlayingRef = useRef(false);
  const tituloAmbienteRef = useRef("");
  tituloAmbienteRef.current = tituloAmbiente;

  const emitirNowPlaying = useCallback((playing: boolean) => {
    if (rellenoActivoRef.current && !actualRef.current) {
      publicarNowPlaying({
        playing,
        youtube_video_id: videoActualRadioRef.current,
        titulo: tituloAmbienteRef.current || "Música de ambiente",
        nombre_cliente: "",
        numero_mesa: null,
        esAmbiente: true,
      });
      return;
    }
    publicarNowPlaying(payloadDesdeCola(actualRef.current, { playing }));
  }, []);

  useEffect(() => {
    emitirNowPlaying(ytPlayingRef.current);
  }, [actual, relleno, tituloAmbiente, emitirNowPlaying]);

  // Heartbeat estable: no reiniciar al cambiar el título (evita parpadeo de ondas).
  useEffect(() => {
    return iniciarHeartbeatNowPlaying(() => {
      const playing = ytPlayingRef.current;
      if (rellenoActivoRef.current && !actualRef.current) {
        return {
          playing,
          youtube_video_id: videoActualRadioRef.current,
          titulo: tituloAmbienteRef.current || "Música de ambiente",
          nombre_cliente: "",
          numero_mesa: null,
          esAmbiente: true,
        };
      }
      return payloadDesdeCola(actualRef.current, { playing });
    });
  }, []);

  const radioWatchdogRef = useRef<number | undefined>(undefined);
  const titulosPoolRef = useRef<Map<string, string>>(new Map());
  const poolRadioRef = useRef<string[]>([]);
  const preferidasRef = useRef<Set<string>>(new Set());
  const playRef = useRef<(id: string, startSeconds?: number) => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});
  const muteRef = useRef<() => void>(() => {});
  const unMuteRef = useRef<() => void>(() => {});
  const setVolumeRef = useRef<(v: number) => void>(() => {});
  const getVolumeRef = useRef<() => number>(() => 100);
  const getStateRef = useRef<() => number>(() => -1);
  const cancelarVozRef = useRef<() => void>(() => {});
  const saludoFinalPendienteRef = useRef(false);
  /** Overlay/TTS de saludo activo (ref: el state llega un tick tarde). */
  const saludoActivoRef = useRef(false);
  const pausaUsuarioRef = useRef(false);
  /** True solo tras PLAYING real (no BUFFERING): sirve para pausa vs video muerto. */
  const yaSonabaRef = useRef(false);
  /** Evita mostrar el error de YT mientras arranca / salta ambiente. */
  const radioCubiertoRef = useRef(false);
  const radioRetryTimerRef = useRef<number | undefined>(undefined);
  /** Invalida watchdogs/timeouts viejos al saltar o cambiar de tema. */
  const radioGenRef = useRef(0);
  /** Un solo Saltar a la vez (varios clics bloqueaban el sistema). */
  const saltarEnCursoRef = useRef(false);
  const visibleAntesRef = useRef(false);
  /** Solo true después de abrir la pestaña Reproductor al menos una vez. */
  const sesionActivaRef = useRef(false);
  const radioErrorLockRef = useRef(false);
  /** Evita mensajes de error mientras el admin salta de tema. */
  const saltandoRef = useRef(false);
  const iniciarRellenoRef = useRef<() => void>(() => {});
  const iniciarCancionRef = useRef<(c: ColaItem) => void>(() => {});
  const completarRef = useRef<(id: number) => void>(() => {});
  /** Canciones de cola (clientes) desde el último anuncio. */
  const cancionesDesdeAnuncioRef = useRef(0);
  const anuncioAudioRef = useRef<HTMLAudioElement | null>(null);
  const anuncioConfigRef = useRef<AnuncioConfig>(leerAnuncioConfig());
  const anuncioMinutosTimerRef = useRef<number | undefined>(undefined);
  const anuncioUnlockRef = useRef(false);
  const anuncioReproduciendoRef = useRef(false);
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
    const gen = ++radioGenRef.current;
    ignoreErrorUntilRef.current = Date.now() + ERROR_GRACE_MS;
    yaSonabaRef.current = false;
    if (comoRadio) {
      radioCubiertoRef.current = true;
      setRadioCubierto(true);
      muteRef.current();
    }
    // Solo reanudar tras recarga real de la pestaña (no en cada tema de cola/ambiente).
    const desde = consumirPosicionTrasRecarga(videoId) ?? 0;
    playRef.current(videoId, desde > 2 ? desde : 0);
    clearRadioWatchdog();

    const esperado = videoId;
    const armWatchdog = (ms: number, yaExtendido: boolean) => {
      radioWatchdogRef.current = window.setTimeout(() => {
        if (gen !== radioGenRef.current) return;
        if (comoRadio) {
          if (!rellenoActivoRef.current) return;
          if (videoActualRadioRef.current !== esperado) return;
          if (pausaUsuarioRef.current && yaSonabaRef.current) return;
          // No sonó de verdad → basura + siguiente (tapa sigue hasta el próximo PLAYING).
          bloqueadosRadioRef.current.add(esperado);
          api.marcarYoutubeBloqueado(accessTokenRef.current, esperado, "watchdog_radio").catch(() => {});
          radioErrorLockRef.current = false;
          const pendiente = colaRef.current.find(
            (c) => !completadasRef.current.has(c.id) && c.estado === "pendiente",
          );
          if (pendiente) {
            rellenoActivoRef.current = false;
            setRelleno(false);
            radioCubiertoRef.current = false;
            setRadioCubierto(false);
            videoActualRadioRef.current = null;
            setError("");
            unMuteRef.current();
            saltarEnCursoRef.current = false;
            setSaltandoUi(false);
            iniciarCancionRef.current(pendiente);
            return;
          }
          setError("");
          iniciarRellenoRef.current();
          return;
        }
        const actual = actualRef.current;
        if (!actual || actual.youtube_video_id !== esperado) return;
        if (rellenoActivoRef.current) return;
        if (pausaUsuarioRef.current && yaSonabaRef.current) return;
        // No saltar pedidos mientras suena saludo/anuncio (TTS puede pausar YT un momento).
        if (saludoActivoRef.current || anuncioReproduciendoRef.current) return;
        // Si sigue cargando, dar otra chance (no marcar completada aún).
        const st = getStateRef.current();
        if (!yaExtendido && (st === 3 || st === -1 || st === 5)) {
          armWatchdog(COLA_WATCHDOG_EXTRA_MS, true);
          return;
        }
        api.marcarYoutubeBloqueado(accessTokenRef.current, esperado, "watchdog_cola").catch(() => {});
        setError("");
        completarRef.current(actual.id);
      }, ms);
    };
    armWatchdog(comoRadio ? RADIO_WATCHDOG_MS : COLA_WATCHDOG_MS, false);
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
    if (radioRetryTimerRef.current) {
      window.clearTimeout(radioRetryTimerRef.current);
      radioRetryTimerRef.current = undefined;
    }
    radioErrorLockRef.current = true;
    rellenoActivoRef.current = false;
    radioArrancadaRef.current = true;
    videoActualRadioRef.current = null;
    radioCubiertoRef.current = false;
    setRelleno(false);
    setRadioCubierto(false);
    setTituloAmbiente("");
    // Ambiente: nunca banner rojo; el local debe seguir solo.
    if (mensaje && !mensaje.includes("YouTube") && !mensaje.includes("embeber")) {
      setError(mensaje);
    } else {
      setError("");
    }
    stopRef.current();
  }, [clearRadioWatchdog]);

  const programarReintentoRadio = useCallback(() => {
    if (radioRetryTimerRef.current) window.clearTimeout(radioRetryTimerRef.current);
    radioRetryTimerRef.current = window.setTimeout(() => {
      radioRetryTimerRef.current = undefined;
      if (hayPedidoEnCola() || actualRef.current) return;
      if (pausaUsuarioRef.current) return;
      bloqueadosRadioRef.current.clear();
      radioArrancadaRef.current = false;
      void (async () => {
        await cargarPoolRadio();
        if (hayPedidoEnCola() || actualRef.current) return;
        iniciarRellenoRef.current();
      })();
    }, RADIO_RETRY_MS);
  }, [cargarPoolRadio]);

  const iniciarRelleno = useCallback(() => {
    if (procesandoRef.current) return;
    if (hayPedidoEnCola()) return;
    if (actualRef.current) return;

    saludoFinalPendienteRef.current = false;
    pausaUsuarioRef.current = false;
    radioErrorLockRef.current = false;
    cancelarVozRef.current();
    setMostrarSaludo(false);
    setError("");

    const pool = poolRadioRef.current;
    if (pool.length === 0) {
      radioCubiertoRef.current = false;
      setRadioCubierto(false);
      setRelleno(false);
      setTituloAmbiente("");
      programarReintentoRadio();
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
    if (!id) {
      // Pool agotado en esta ronda → reintentar solo, sin logo negro eterno.
      radioCubiertoRef.current = false;
      setRadioCubierto(false);
      setRelleno(false);
      setTituloAmbiente("");
      programarReintentoRadio();
      return;
    }

    rellenoActivoRef.current = true;
    radioArrancadaRef.current = true;
    setRelleno(true);
    setActual(null);
    const titulo = titulosPoolRef.current.get(id) ?? "";
    tituloAmbienteRef.current = titulo;
    setTituloAmbiente(titulo);
    videoActualRadioRef.current = id;
    playVideo(id, true);
  }, [playVideo, programarReintentoRadio]);

  iniciarRellenoRef.current = iniciarRelleno;

  const presentarSaludo = useCallback((cancion: ColaItem, onListo?: () => void) => {
    cancelarVozRef.current();
    const texto = cancion.saludo?.trim();
    if (!texto) {
      setMostrarSaludo(false);
      saludoActivoRef.current = false;
      onListo?.();
      return;
    }
    // Pedidos/saludo nunca detrás de la tapa de ambiente.
    radioCubiertoRef.current = false;
    setRadioCubierto(false);
    setMostrarSaludo(true);
    saludoActivoRef.current = true;
    const mostradoDesde = Date.now();
    const MIN_OVERLAY_MS = 6000;
    const volAntes = getVolumeRef.current();
    // Superponer: YouTube sigue; solo baja un poco para oír la voz.
    const volDuranteSaludo = Math.max(28, Math.min(45, Math.round((volAntes || 100) * 0.4)));
    setVolumeRef.current(volDuranteSaludo);
    pausaUsuarioRef.current = false;
    unMuteRef.current();
    resumeRef.current();

    // Chrome/Edge a veces pausan el iframe al hablar TTS; lo reanudamos.
    const keepYt = window.setInterval(() => {
      if (pausaUsuarioRef.current) return;
      resumeRef.current();
      setVolumeRef.current(volDuranteSaludo);
    }, 800);

    let cerrado = false;
    let delayOverlay: number | undefined;
    const cerrar = () => {
      if (cerrado) return;
      cerrado = true;
      window.clearInterval(keepYt);
      if (delayOverlay) window.clearTimeout(delayOverlay);
      setVolumeRef.current(volAntes > 5 ? volAntes : 100);
      pausaUsuarioRef.current = false;
      saludoActivoRef.current = false;
      resumeRef.current();
      setMostrarSaludo(false);
      onListo?.();
    };
    const cerrarCuandoToque = () => {
      const falta = MIN_OVERLAY_MS - (Date.now() - mostradoDesde);
      if (falta > 0) {
        delayOverlay = window.setTimeout(cerrar, falta);
        return;
      }
      cerrar();
    };
    const cancelarVoz = leerSaludo(texto, {
      onStart: () => {
        pausaUsuarioRef.current = false;
        resumeRef.current();
        setVolumeRef.current(volDuranteSaludo);
      },
      onEnd: cerrarCuandoToque,
    });
    const tope = window.setTimeout(cerrarCuandoToque, 40000);
    cancelarVozRef.current = () => {
      window.clearTimeout(tope);
      window.clearInterval(keepYt);
      if (delayOverlay) window.clearTimeout(delayOverlay);
      cancelarVoz();
      cerrar();
    };
  }, []);

  /** Prepara el Audio del anuncio (debe llamarse tras un click del admin). */
  const asegurarAudioAnuncio = useCallback(() => {
    if (!anuncioAudioRef.current) {
      const audio = new Audio("/anuncio.mp3");
      audio.preload = "auto";
      audio.volume = 1;
      anuncioAudioRef.current = audio;
    }
    return anuncioAudioRef.current;
  }, []);

  const desbloquearAudioAnuncio = useCallback(() => {
    const audio = asegurarAudioAnuncio();
    if (anuncioUnlockRef.current) return;
    const prev = audio.volume;
    audio.volume = 0.001;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = prev || 1;
        anuncioUnlockRef.current = true;
      })
      .catch(() => {
        audio.volume = prev || 1;
      });
  }, [asegurarAudioAnuncio]);

  /** Anuncio de casa según config del panel Anuncios. */
  const reproducirAnuncio = useCallback((opts?: { reanudar?: boolean }): Promise<void> => {
    const reanudar = opts?.reanudar !== false;
    return new Promise((resolve) => {
      if (anuncioReproduciendoRef.current) {
        resolve();
        return;
      }
      try {
        const audio = asegurarAudioAnuncio();
        anuncioReproduciendoRef.current = true;
        const volAntes = getVolumeRef.current();
        // Superponer: YouTube sigue; baja un poco para oír el anuncio.
        const volDurante = Math.max(22, Math.min(40, Math.round((volAntes || 100) * 0.35)));
        setVolumeRef.current(volDurante);
        pausaUsuarioRef.current = false;
        // No tapar con cover de radio: el anuncio debe oírse sobre el video.
        unMuteRef.current();
        resumeRef.current();

        const keepYt = window.setInterval(() => {
          if (pausaUsuarioRef.current) return;
          resumeRef.current();
          setVolumeRef.current(volDurante);
        }, 800);

        let done = false;
        const fin = () => {
          if (done) return;
          done = true;
          window.clearInterval(keepYt);
          anuncioReproduciendoRef.current = false;
          setVolumeRef.current(volAntes || 100);
          if (reanudar && !pausaUsuarioRef.current) resumeRef.current();
          resolve();
        };

        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        const tope = window.setTimeout(fin, 60_000);
        const finConTope = () => {
          window.clearTimeout(tope);
          fin();
        };
        audio.onended = finConTope;
        audio.onerror = () => finConTope();
        void audio.play().then(() => {
          anuncioUnlockRef.current = true;
          resumeRef.current();
          setVolumeRef.current(volDurante);
        }).catch(() => {
          window.setTimeout(() => {
            void audio.play().catch(() => finConTope());
          }, 120);
        });
      } catch {
        anuncioReproduciendoRef.current = false;
        resolve();
      }
    });
  }, [asegurarAudioAnuncio]);

  const reiniciarTimerMinutos = useCallback(() => {
    if (anuncioMinutosTimerRef.current) {
      window.clearInterval(anuncioMinutosTimerRef.current);
      anuncioMinutosTimerRef.current = undefined;
    }
    const cfg = anuncioConfigRef.current;
    if (!cfg.activo || cfg.modo !== "minutos" || !sesionActivaRef.current) return;
    const ms = Math.max(1, cfg.cadaMinutos) * 60_000;
    anuncioMinutosTimerRef.current = window.setInterval(() => {
      if (!sesionActivaRef.current) return;
      if (!anuncioConfigRef.current.activo) return;
      if (anuncioConfigRef.current.modo !== "minutos") return;
      if (anuncioReproduciendoRef.current) return;
      void reproducirAnuncio({ reanudar: true });
    }, ms);
  }, [reproducirAnuncio]);

  useEffect(() => {
    const syncConfig = () => {
      const prev = anuncioConfigRef.current;
      const next = leerAnuncioConfig();
      anuncioConfigRef.current = next;
      if (prev.modo !== next.modo || prev.cadaCanciones !== next.cadaCanciones) {
        cancionesDesdeAnuncioRef.current = 0;
      }
      reiniciarTimerMinutos();
    };
    const onPlayNow = () => {
      desbloquearAudioAnuncio();
      void reproducirAnuncio({ reanudar: true });
    };
    const onPointer = () => desbloquearAudioAnuncio();
    window.addEventListener(ANUNCIO_CONFIG_EVENT, syncConfig);
    window.addEventListener("storage", syncConfig);
    window.addEventListener(ANUNCIO_PLAY_NOW_EVENT, onPlayNow);
    window.addEventListener("pointerdown", onPointer);
    syncConfig();
    return () => {
      window.removeEventListener(ANUNCIO_CONFIG_EVENT, syncConfig);
      window.removeEventListener("storage", syncConfig);
      window.removeEventListener(ANUNCIO_PLAY_NOW_EVENT, onPlayNow);
      window.removeEventListener("pointerdown", onPointer);
      if (anuncioMinutosTimerRef.current) {
        window.clearInterval(anuncioMinutosTimerRef.current);
      }
    };
  }, [reproducirAnuncio, reiniciarTimerMinutos, desbloquearAudioAnuncio]);

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
    radioCubiertoRef.current = false;
    setRadioCubierto(false);
    saltarEnCursoRef.current = false;
    setSaltandoUi(false);
    clearRadioWatchdog();
    cancelarVozRef.current();
    setMostrarSaludo(false);
    saludoActivoRef.current = false;
    setRelleno(false);
    setError("");
    setTituloAmbiente("");
    unMuteRef.current();

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

  iniciarCancionRef.current = iniciarCancion;

  const completar = useCallback(async (id: number) => {
    saludoFinalPendienteRef.current = false;
    cancelarVozRef.current();
    setMostrarSaludo(false);
    limpiarPosicionRepro();
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

  /** Suma 1 tema (cola o radio) hacia el anuncio según config. */
  const contarCancionHaciaAnuncio = useCallback(async () => {
    const cfg = anuncioConfigRef.current;
    if (!cfg.activo || cfg.modo !== "canciones") return;
    cancionesDesdeAnuncioRef.current += 1;
    const cada = Math.max(1, cfg.cadaCanciones);
    if (cancionesDesdeAnuncioRef.current < cada) return;
    cancionesDesdeAnuncioRef.current = 0;
    await reproducirAnuncio({ reanudar: false });
  }, [reproducirAnuncio]);

  const primerPendienteCola = () =>
    colaRef.current.find(
      (c) => !completadasRef.current.has(c.id) && c.estado === "pendiente",
    ) ?? null;

  const onEnded = useCallback(() => {
    // Fin natural del tema (no es pausa del admin).
    limpiarPosicionRepro();
    pausaUsuarioRef.current = false;
    if (procesandoRef.current) return;
    if (radioErrorLockRef.current) return;
    if (rellenoActivoRef.current) {
      void (async () => {
        await contarCancionHaciaAnuncio();
        const pendiente = primerPendienteCola();
        if (pendiente) {
          // Termina ambiente → pasa a la cola del cliente (sin haberla cortado antes).
          rellenoActivoRef.current = false;
          setRelleno(false);
          videoActualRadioRef.current = null;
          clearRadioWatchdog();
          await iniciarCancion(pendiente);
          return;
        }
        if (!hayPedidoEnCola()) iniciarRelleno();
      })();
      return;
    }
    const current = actualRef.current;
    if (!current) {
      if (!hayPedidoEnCola()) iniciarRelleno();
      return;
    }

    const terminarConPosibleAnuncio = async () => {
      await contarCancionHaciaAnuncio();
      await completar(current.id);
    };

    const momentoFinal =
      !!current.saludo?.trim() && (current.saludo_momento ?? "inicio") === "final";
    if (momentoFinal && !saludoFinalPendienteRef.current) {
      saludoFinalPendienteRef.current = true;
      presentarSaludo(current, () => {
        void terminarConPosibleAnuncio();
      });
      return;
    }
    void terminarConPosibleAnuncio();
  }, [completar, iniciarRelleno, iniciarCancion, presentarSaludo, contarCancionHaciaAnuncio, clearRadioWatchdog]);

  const onError = useCallback((code: number) => {
    if (procesandoRef.current) return;
    if (radioErrorLockRef.current) return;
    if (Date.now() < ignoreErrorUntilRef.current && !rellenoActivoRef.current) return;

    const embedMuerto = code === 100 || code === 101 || code === 150 || code === 2;

    if (!rellenoActivoRef.current) {
      const current = actualRef.current;
      const maloId = current?.youtube_video_id;
      if (maloId && embedMuerto) {
        api.marcarYoutubeBloqueado(accessToken, maloId, "player_error_cola").catch(() => {});
      }
      setError("");
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
    setError("");
    radioCubiertoRef.current = true;
    setRadioCubierto(true);
    if (hayPedidoEnCola()) {
      const pendiente = primerPendienteCola();
      rellenoActivoRef.current = false;
      setRelleno(false);
      radioCubiertoRef.current = false;
      setRadioCubierto(false);
      videoActualRadioRef.current = null;
      unMuteRef.current();
      saltarEnCursoRef.current = false;
      setSaltandoUi(false);
      if (pendiente) void iniciarCancion(pendiente);
      else detenerRadio();
      return;
    }
    radioErrorLockRef.current = false;
    iniciarRelleno();
  }, [completar, iniciarRelleno, iniciarCancion, detenerRadio, clearRadioWatchdog, accessToken]);

  const destaparRadio = useCallback(() => {
    yaSonabaRef.current = true;
    clearRadioWatchdog();
    saltarEnCursoRef.current = false;
    setSaltandoUi(false);
    unMuteRef.current();
    const vol = getVolumeRef.current();
    if (vol < 5) setVolumeRef.current(100);
    if (radioCubiertoRef.current) {
      radioCubiertoRef.current = false;
      setRadioCubierto(false);
    }
  }, [clearRadioWatchdog]);

  const handlePlayingChange = useCallback((playing: boolean) => {
    if (playing) {
      pausaUsuarioRef.current = false;
      radioErrorLockRef.current = false;
      setError("");
      // Destapar siempre al sonar: el check st===1 a veces fallaba y dejaba
      // pantalla negra con logo mientras el audio corría debajo.
      destaparRadio();
      const mesa = actualRef.current;
      if (mesa?.youtube_video_id) agregarAlPool(mesa.youtube_video_id, mesa.titulo_cancion);
    } else if (
      !saltarEnCursoRef.current &&
      !anuncioReproduciendoRef.current &&
      !saludoActivoRef.current &&
      !radioCubiertoRef.current &&
      yaSonabaRef.current
    ) {
      pausaUsuarioRef.current = true;
    }
    onPlayingChange?.(playing);
    ytPlayingRef.current = playing;
    emitirNowPlaying(playing);
  }, [onPlayingChange, agregarAlPool, destaparRadio, emitirNowPlaying]);

  const { ready, play, resume, pause, stop, mute, unMute, setVolume, getVolume, getPlayerState, getCurrentTime } =
    useYouTubePlayer(onEnded, onError, handlePlayingChange);
  playRef.current = play;
  resumeRef.current = resume;
  pauseRef.current = pause;
  stopRef.current = stop;
  muteRef.current = mute;
  unMuteRef.current = unMute;
  setVolumeRef.current = setVolume;
  getVolumeRef.current = getVolume;
  getStateRef.current = getPlayerState;

  // Si la tapa negra se queda trabada (audio sí, video no), forzar destape.
  useEffect(() => {
    if (!radioCubierto || !ready) return;
    const poll = window.setInterval(() => {
      if (!radioCubiertoRef.current) return;
      const st = getStateRef.current();
      let t = 0;
      try {
        t = getCurrentTime();
      } catch {
        t = 0;
      }
      // PLAYING real, o el tiempo ya avanzó (audio corriendo bajo la tapa).
      if (st === 1 || t > 0.25) destaparRadio();
    }, 300);
    return () => window.clearInterval(poll);
  }, [radioCubierto, ready, getCurrentTime, destaparRadio]);

  // Persistir posición para no reiniciar si la pestaña se recarga.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!ytPlayingRef.current) return;
      const vid =
        actualRef.current?.youtube_video_id ?? videoActualRadioRef.current;
      if (!vid) return;
      const t = getCurrentTime();
      if (t > 2) guardarPosicionRepro(vid, t);
    }, 2000);
    const onBeforeUnload = () => {
      if (!ytPlayingRef.current) return;
      const vid =
        actualRef.current?.youtube_video_id ?? videoActualRadioRef.current;
      if (!vid) return;
      const t = getCurrentTime();
      if (t > 2) {
        guardarPosicionRepro(vid, t);
        marcarReanudarTrasRecarga();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [getCurrentTime]);

  // Si el ambiente quedó parado, reanudar solo (sin que el admin vuelva a la PC).
  useEffect(() => {
    if (!visible || !ready || !sesionActivaRef.current) return;
    if (actual || relleno) return;
    if (poolSize === 0) return;
    if (hayPedidoEnCola()) return;
    const t = window.setTimeout(() => {
      if (actualRef.current || rellenoActivoRef.current || hayPedidoEnCola()) return;
      if (pausaUsuarioRef.current) return;
      radioArrancadaRef.current = false;
      radioErrorLockRef.current = false;
      setError("");
      iniciarRellenoRef.current();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [visible, ready, actual, relleno, poolSize, error]);

  useEffect(() => {
    // No arrancar audio hasta que el admin abra la pestaña Reproductor.
    if (!sesionActivaRef.current) return;
    if (!ready || procesandoRef.current) return;
    if (saludoFinalPendienteRef.current) return;

    const enCola = cola.filter((c) => !completadasRef.current.has(c.id));
    const reproduciendo = enCola.find((c) => c.estado === "reproduciendo");
    const pendiente = enCola.find((c) => c.estado === "pendiente");

    // Ambiente de casa sonando: la cola del cliente espera al fin del tema actual.
    // Antes se cortaba al instante y pelea con la radio (bloqueo / vuelve atrás).
    if (rellenoActivoRef.current) {
      if (reproduciendo && actualRef.current?.id !== reproduciendo.id) {
        rellenoActivoRef.current = false;
        setRelleno(false);
        videoActualRadioRef.current = null;
        clearRadioWatchdog();
        setActual(reproduciendo);
        pausaUsuarioRef.current = false;
        playVideo(reproduciendo.youtube_video_id, false);
      }
      return;
    }

    if (enCola.length === 0) {
      if (actual) {
        cancelarVozRef.current();
        setMostrarSaludo(false);
        setActual(null);
      }
      if (poolVersion === 0) return;
      if (!radioArrancadaRef.current && !rellenoActivoRef.current) iniciarRelleno();
      return;
    }

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
  }, [ready, cola, actual, iniciarCancion, iniciarRelleno, playVideo, poolVersion, visible, clearRadioWatchdog]);

  // Al cargar el pool: solo ambientar si ya se abrió Reproductor.
  useEffect(() => {
    if (!sesionActivaRef.current) return;
    if (!ready || poolVersion === 0) return;
    if (hayPedidoEnCola() || actualRef.current) return;
    if (rellenoActivoRef.current) return;
    radioArrancadaRef.current = false;
    iniciarRelleno();
  }, [poolVersion, ready, iniciarRelleno, visible]);

  /** Pedido desde el click de “Reproductor” en el admin: sonar sin segundo click. */
  const forzarSonidoYPlay = useCallback(() => {
    if (!ready) return;
    sesionActivaRef.current = true;
    pausaUsuarioRef.current = false;
    desbloquearAudioAnuncio();
    unMuteRef.current();
    resumeRef.current();
    const vol = getVolumeRef.current();
    if (vol < 5) setVolumeRef.current(100);

    void (async () => {
      if (hayPedidoEnCola()) {
        // El efecto de cola encola; mientras tanto reanudar si ya hay video.
        resumeRef.current();
        unMuteRef.current();
        return;
      }
      if (actualRef.current || rellenoActivoRef.current) {
        resumeRef.current();
        unMuteRef.current();
        return;
      }
      if (poolRadioRef.current.length === 0) {
        await cargarPoolRadio();
      }
      if (hayPedidoEnCola() || actualRef.current) {
        resumeRef.current();
        unMuteRef.current();
        return;
      }
      if (!rellenoActivoRef.current) {
        radioArrancadaRef.current = false;
        iniciarRelleno();
      } else {
        resumeRef.current();
        unMuteRef.current();
      }
    })();
  }, [ready, desbloquearAudioAnuncio, cargarPoolRadio, iniciarRelleno]);

  // Click en admin → BroadcastChannel / unlock: reanudar con sonido.
  useEffect(() => {
    if (!visible || !ready) return;
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel(REPRO_CMD_CHANNEL);
      ch.onmessage = (ev) => {
        if (ev.data?.type === "play") forzarSonidoYPlay();
      };
    } catch {
      /* ignore */
    }
    if (consumirUnlockAudioReciente()) {
      forzarSonidoYPlay();
    }
    const onVis = () => {
      if (document.visibilityState === "visible" && consumirUnlockAudioReciente()) {
        forzarSonidoYPlay();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      try {
        ch?.close();
      } catch {
        /* ignore */
      }
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [visible, ready, forzarSonidoYPlay]);

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
    desbloquearAudioAnuncio();
    reiniciarTimerMinutos();

    const pedirAuto = acabaDeAbrir || consumirUnlockAudioReciente();
    if (!pedirAuto) {
      // No forzar resume aquí: al cambiar deps del efecto reanudaba encima de la pausa del admin.
      return;
    }

    // Primera vez / click reciente en Reproductor: arrancar ambiente o cola con sonido.
    forzarSonidoYPlay();
  }, [
    visible,
    ready,
    iniciarRelleno,
    cargarPoolRadio,
    reiniciarTimerMinutos,
    desbloquearAudioAnuncio,
    forzarSonidoYPlay,
  ]);

  const proximas = cola.filter((c) => c.estado === "pendiente");

  const saltar = async () => {
    // Varios clics seguidos = carreras (varios iniciarRelleno / watchdogs) → se “loquea”.
    if (saltarEnCursoRef.current) return;
    saltarEnCursoRef.current = true;
    setSaltandoUi(true);
    limpiarPosicionRepro();

    cancelarVozRef.current();
    if (anuncioAudioRef.current) {
      anuncioAudioRef.current.pause();
      anuncioAudioRef.current.currentTime = 0;
    }
    anuncioReproduciendoRef.current = false;
    setMostrarSaludo(false);
    saludoFinalPendienteRef.current = false;
    pausaUsuarioRef.current = false;
    radioErrorLockRef.current = false;
    saltandoRef.current = true;
    ignoreErrorUntilRef.current = Date.now() + ERROR_GRACE_MS;
    // Invalida timeouts pendientes de temas anteriores.
    radioGenRef.current += 1;
    clearRadioWatchdog();
    setError("");
    saludoActivoRef.current = false;

    // Tapa/mute solo al saltar ambiente (no pedidos de mesa ni saludo).
    const saltandoAmbiente =
      !actualRef.current && (rellenoActivoRef.current || !!videoActualRadioRef.current);
    if (saltandoAmbiente) {
      radioCubiertoRef.current = true;
      setRadioCubierto(true);
      muteRef.current();
    }

    const liberarSiQuedoColgado = window.setTimeout(() => {
      saltarEnCursoRef.current = false;
      setSaltandoUi(false);
      saltandoRef.current = false;
    }, 10_000);

    try {
      const current = actualRef.current;
      if (current) {
        await contarCancionHaciaAnuncio();
        await completar(current.id);
        // Pedido de mesa: liberar Saltar; la sync arranca el siguiente.
        window.clearTimeout(liberarSiQuedoColgado);
        saltarEnCursoRef.current = false;
        setSaltandoUi(false);
        return;
      }

      if (hayPedidoEnCola()) {
        const pendiente = colaRef.current.find(
          (c) => !completadasRef.current.has(c.id) && c.estado === "pendiente",
        );
        if (pendiente) {
          await iniciarCancion(pendiente);
          return;
        }
        const enCurso = colaRef.current.find(
          (c) => !completadasRef.current.has(c.id) && c.estado === "reproduciendo",
        );
        if (enCurso) {
          await contarCancionHaciaAnuncio();
          await completar(enCurso.id);
          return;
        }
      }

      const actualRadio = videoActualRadioRef.current;
      if (actualRadio || rellenoActivoRef.current) {
        await contarCancionHaciaAnuncio();
        const pendiente = primerPendienteCola();
        if (pendiente) {
          rellenoActivoRef.current = false;
          setRelleno(false);
          videoActualRadioRef.current = null;
          clearRadioWatchdog();
          await iniciarCancion(pendiente);
          return;
        }
        if (actualRadio) {
          bloqueadosRadioRef.current.add(actualRadio);
          if (!yaSonabaRef.current) {
            api.marcarYoutubeBloqueado(accessTokenRef.current, actualRadio, "saltar_radio").catch(() => {});
          }
        }
        if (poolRadioRef.current.length === 0) await cargarPoolRadio();
        radioArrancadaRef.current = false;
        iniciarRelleno();
        return;
      }

      if (poolRadioRef.current.length === 0) await cargarPoolRadio();
      radioArrancadaRef.current = false;
      iniciarRelleno();
    } catch {
      window.clearTimeout(liberarSiQuedoColgado);
      saltarEnCursoRef.current = false;
      setSaltandoUi(false);
      radioCubiertoRef.current = false;
      setRadioCubierto(false);
    } finally {
      saltandoRef.current = false;
    }
  };

  const puedeSaltar =
    !saltandoUi && (!!actual || relleno || hayPedidoEnCola() || radioCubierto || !!error);

  return (
    <div className="reproductor-wrap">
      <div className="reproductor-controles">
        <div className="rc-botones">
          <button
            type="button"
            onClick={saltar}
            disabled={!puedeSaltar}
            className="btn-secondary rc-btn"
          >
            Saltar
          </button>
          <button
            type="button"
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

        <div
          className="player-wrap"
          style={{
            visibility: actual || relleno || radioCubierto ? "visible" : "hidden",
          }}
        >
          <div id="yt-player" />
        </div>

        {radioCubierto && (
          <div className="player-cover" aria-live="polite">
            <BrandLogo size="nav" />
          </div>
        )}

        {!actual && !relleno && !radioCubierto && (
          <div className="idle">
            <BrandLogo size="hero" className="idle-logo" />
            <p className="lema">{es.marca.lema}</p>
            {error ? null : (
              <p className="idle-hint">{textoIdleAmbiente(poolVersion, poolSize)}</p>
            )}
          </div>
        )}

        {relleno && !actual && !radioCubierto && (
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
              {zonaCola(actual)}
            </div>
            <div className="overlay-saludo-text">&ldquo;{actual.saludo.trim()}&rdquo;</div>
          </div>
        )}

        {actual && (
          <div className="now-playing-bar">
            <span className="np-label">
              {actual.tipo === "karaoke" ? es.pantalla.cantando : es.pantalla.suena}:
            </span>
            <span className="np-nombre">
              {actual.nombre_cliente === zonaCola(actual)
                ? zonaCola(actual)
                : actual.nombre_cliente}
            </span>
            {actual.nombre_cliente !== zonaCola(actual) && (
              <span className="np-mesa">— {zonaCola(actual)}</span>
            )}
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
                    <span className="proxima-nombre">
                      {c.nombre_cliente === zonaCola(c) ? zonaCola(c) : c.nombre_cliente}
                    </span>
                    {c.nombre_cliente !== zonaCola(c) && (
                      <span className="proxima-mesa">{zonaCola(c)}</span>
                    )}
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
