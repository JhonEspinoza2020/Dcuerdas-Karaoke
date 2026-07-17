import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  es,
  speechRecognitionSupported,
  startVoiceSearch,
  supabase,
  validarBusqueda,
  validarSaludo,
  LIMITES,
  COOLDOWNS,
  msRestantesRateLimit,
  marcarRateLimit,
  formatearEspera,
  type VideoResult,
  type LimiteCola,
} from "@dcuerdas/shared";
import { ColaClientePanel, mensajeAntes, type ColaPublicaItem } from "./ColaClientePanel";
import { MusicIcon, SearchIcon, HeartIcon, ArrowRightIcon, CheckIcon, PlayIcon, MicIcon } from "./Icons";
import { verificarEmbedYoutube } from "../verificarEmbedYoutube";

/** Espera a que el usuario deje de escribir antes de pegarle a YouTube. */
const DEBOUNCE_MS = 1100;
const MIN_CARACTERES = 3;

function mensajeLimiteUi(limite: LimiteCola, t: typeof es.musica): string {
  if (limite.motivo === "limite_mesa" || limite.motivo === "limite_persona" || !limite.puede_encolar) {
    if (limite.espera_segundos > 0) {
      const mins = Math.max(1, Math.ceil(limite.espera_segundos / 60));
      return t.limiteEspera.replace("{mins}", String(mins));
    }
    return t.limiteAlcanzado;
  }
  return t.limiteAlcanzado;
}

type Props = {
  numeroMesa: number;
  token: string;
  nombre: string;
  modo: "musica";
  onContinuar: () => void;
};

type ExitoState = {
  id: number;
  posicion: number;
  titulo: string;
  antesDeTi: number;
};

export function KaraokeStep({ numeroMesa, token, nombre, modo, onContinuar }: Props) {
  const t = es.musica;
  const AccionIcon = MusicIcon;
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<VideoResult[]>([]);
  const [seleccionado, setSeleccionado] = useState<VideoResult | null>(null);
  const [saludo, setSaludo] = useState("");
  const [saludoMomento, setSaludoMomento] = useState<"inicio" | "final">("inicio");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [esperandoEscritura, setEsperandoEscritura] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [exito, setExito] = useState<ExitoState | null>(null);
  const [cola, setCola] = useState<ColaPublicaItem[]>([]);
  const [limiteCola, setLimiteCola] = useState<LimiteCola | null>(null);
  const envioRef = useRef<HTMLDivElement | null>(null);
  const busquedaIdRef = useRef(0);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const busquedaInputRef = useRef<HTMLInputElement | null>(null);
  const detenerVozRef = useRef<(() => void) | null>(null);

  const actualizarLimite = useCallback(async () => {
    if (!nombre.trim()) return;
    const espera = msRestantesRateLimit(`limite-${numeroMesa}`, COOLDOWNS.consultarLimiteMs);
    if (espera > 0) return;
    try {
      marcarRateLimit(`limite-${numeroMesa}`);
      const limite = await api.consultarLimiteCola(numeroMesa, token, nombre);
      setLimiteCola(limite);
    } catch {
      /* El servidor valida al encolar. */
    }
  }, [numeroMesa, token, nombre]);

  const actualizarCola = useCallback(async () => {
    const { data } = await supabase
      .from("cola_publica")
      .select("id, numero_mesa, etiqueta, tipo, titulo_cancion, nombre_cliente, estado")
      .order("creado_en");
    if (data) setCola(data as ColaPublicaItem[]);
    void actualizarLimite();
  }, [actualizarLimite]);

  useEffect(() => {
    void actualizarLimite();
    const tick = window.setInterval(() => {
      void actualizarLimite();
    }, 60_000);
    return () => window.clearInterval(tick);
  }, [actualizarLimite]);

  useEffect(() => {
    actualizarCola();
    const channel = supabase
      .channel(`cola-mesa-${numeroMesa}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cola_reproduccion" }, () => {
        actualizarCola();
      })
      .subscribe();
    const intervalo = window.setInterval(actualizarCola, 20_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(intervalo);
    };
  }, [numeroMesa, actualizarCola]);

  useEffect(() => {
    return () => detenerVozRef.current?.();
  }, []);

  useEffect(() => {
    const q = query.trim();
    // Cualquier tecla invalida respuestas viejas que aún no llegaron.
    busquedaIdRef.current += 1;
    const idBusqueda = busquedaIdRef.current;

    if (q.length < MIN_CARACTERES) {
      setResultados([]);
      setBuscando(false);
      setEsperandoEscritura(false);
      return;
    }

    // Mientras escribe: no llamar API ni mostrar errores viejos.
    setEsperandoEscritura(true);
    setBuscando(false);
    setError("");

    const timer = window.setTimeout(async () => {
      if (busquedaIdRef.current !== idBusqueda) return;
      const espera = msRestantesRateLimit(`buscar-${numeroMesa}`, COOLDOWNS.busquedaMs);
      if (espera > 0) {
        setEsperandoEscritura(false);
        setBuscando(false);
        return;
      }
      setEsperandoEscritura(false);
      setBuscando(true);
      try {
        marcarRateLimit(`buscar-${numeroMesa}`);
        const res = await api.buscarYoutube(numeroMesa, token, q, modo);
        if (busquedaIdRef.current !== idBusqueda) return;
        setResultados(res.resultados);
        setError("");
        // Cerrar teclado móvil para que no tape los resultados.
        busquedaInputRef.current?.blur();
        (document.activeElement as HTMLElement | null)?.blur?.();
      } catch (e) {
        if (busquedaIdRef.current !== idBusqueda) return;
        const msg = e instanceof Error ? e.message : "Error al buscar";
        // Cooldown de API: no asustar al usuario si sigue escribiendo/probando.
        if (/espera unos segundos/i.test(msg)) {
          setError("");
          return;
        }
        setResultados([]);
        setError(msg);
        busquedaInputRef.current?.blur();
      } finally {
        if (busquedaIdRef.current === idBusqueda) setBuscando(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query, numeroMesa, token, modo]);

  useEffect(() => {
    if (seleccionado && envioRef.current) {
      envioRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [seleccionado]);

  const elegirCancion = (v: VideoResult) => {
    setSeleccionado(v);
    setError("");
  };

  const buscarPorVoz = () => {
    if (!speechRecognitionSupported()) {
      setError("Tu navegador no permite búsqueda por voz.");
      return;
    }
    if (escuchando) {
      detenerVozRef.current?.();
      setEscuchando(false);
      return;
    }
    setError("");
    detenerVozRef.current = startVoiceSearch({
      onStart: () => setEscuchando(true),
      onEnd: () => setEscuchando(false),
      onError: () => {
        setEscuchando(false);
        setError("No se pudo escuchar. Revisa el permiso del micrófono.");
      },
      onResult: (text) => {
        setSeleccionado(null);
        setQuery(text);
        busquedaInputRef.current?.blur();
      },
    });
  };

  const cambiarCancion = () => {
    setSeleccionado(null);
    setSaludo("");
    setSaludoMomento("inicio");
  };

  const encolar = useCallback(async () => {
    if (!seleccionado) return;

    if (limiteCola && !limiteCola.puede_encolar) {
      setError(mensajeLimiteUi(limiteCola, t));
      return;
    }

    const checkSaludo = validarSaludo(saludo);
    if (!checkSaludo.ok) {
      setError(checkSaludo.error);
      return;
    }

    const esperaEnvio = msRestantesRateLimit(`encolar-${numeroMesa}-${nombre}`, COOLDOWNS.encolarMs);
    if (esperaEnvio > 0) {
      setError(`Espera ${formatearEspera(esperaEnvio)} antes de enviar otra canción.`);
      return;
    }

    if (checkSaludo.valor) {
      const esperaSaludo = msRestantesRateLimit(`saludo-${numeroMesa}-${nombre}`, COOLDOWNS.saludoMs);
      if (esperaSaludo > 0) {
        setError(`Ya enviaste un saludo hace poco. Espera ${formatearEspera(esperaSaludo)}.`);
        return;
      }
    }

    setLoading(true);
    setError("");
    try {
      // Preflight real: misma prueba que el reproductor admin (detecta LatinAutor).
      const reproducible = await verificarEmbedYoutube(seleccionado.video_id);
      if (!reproducible) {
        api.reportarYoutubeBloqueado(numeroMesa, token, seleccionado.video_id, "cliente_preflight")
          .catch(() => {});
        api.invalidarBusquedaVideo(seleccionado.video_id);
        setResultados((prev) => prev.filter((v) => v.video_id !== seleccionado.video_id));
        setSeleccionado(null);
        setError(
          "Ese video lo bloquea YouTube en el local. Elige otra versión (busca con “letra” o “karaoke”).",
        );
        // Evitar que el buscador recupere el foco y abra el teclado encima de los resultados.
        window.setTimeout(() => {
          busquedaInputRef.current?.blur();
          (document.activeElement as HTMLElement | null)?.blur?.();
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 0);
        return;
      }

      const res = await api.encolarCancion({
        numero_mesa: numeroMesa,
        token,
        youtube_video_id: seleccionado.video_id,
        titulo_cancion: seleccionado.titulo,
        nombre_cliente: nombre,
        saludo: checkSaludo.valor || undefined,
        saludo_momento: checkSaludo.valor ? saludoMomento : undefined,
      });
      marcarRateLimit(`encolar-${numeroMesa}-${nombre}`);
      if (checkSaludo.valor) marcarRateLimit(`saludo-${numeroMesa}-${nombre}`);
      if (res.limite) setLimiteCola(res.limite);
      else void actualizarLimite();
      await actualizarCola();
      const { data } = await supabase
        .from("cola_publica")
        .select("id, numero_mesa, etiqueta, tipo, titulo_cancion, nombre_cliente, estado")
        .order("creado_en");
      const colaActual = (data ?? []) as ColaPublicaItem[];
      const idx = colaActual.findIndex((c) => c.id === res.id);
      setExito({
        id: res.id,
        posicion: idx >= 0 ? idx + 1 : (res.posicion ?? 1),
        titulo: res.titulo_cancion,
        antesDeTi: idx >= 0 ? idx : 0,
      });
      setCola(colaActual);
      setSeleccionado(null);
      setSaludo("");
      setSaludoMomento("inicio");
      setResultados([]);
      setQuery("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al encolar";
      setError(msg);
      if (seleccionado && /no se puede reproducir|video_no_reproducible|bloquea/i.test(msg)) {
        api.invalidarBusquedaVideo(seleccionado.video_id);
        setResultados((prev) => prev.filter((v) => v.video_id !== seleccionado.video_id));
        setSeleccionado(null);
        window.setTimeout(() => {
          busquedaInputRef.current?.blur();
          (document.activeElement as HTMLElement | null)?.blur?.();
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 0);
      }
    } finally {
      setLoading(false);
    }
  }, [seleccionado, saludo, saludoMomento, nombre, numeroMesa, token, actualizarCola, actualizarLimite, limiteCola, t]);

  const agregarOtra = () => {
    setExito(null);
    setSeleccionado(null);
  };

  const bloqueado = limiteCola !== null && !limiteCola.puede_encolar;
  const tengoEnCola = cola.some((c) => c.numero_mesa === numeroMesa);
  const textoCupo = limiteCola
    ? t.limiteCupo
      .replace("{usadas}", String(limiteCola.usadas_mesa ?? limiteCola.usadas_persona ?? 0))
      .replace("{max}", String(limiteCola.max_mesa ?? limiteCola.max_persona ?? 5))
    : null;

  return (
    <div className="step-card">
      <h2 className="step-title"><AccionIcon size={24} /> {t.paso}</h2>

      {error && (
        <div className="error-msg" ref={errorRef} role="alert">
          {error}
        </div>
      )}

      {exito ? (
        <div className="exito-cola-card">
          <div className="exito-cola-icon"><CheckIcon size={28} /></div>
          <div className="exito-cola-titulo">{es.cola.enviada}</div>
          <div className="exito-cola-cancion">{exito.titulo}</div>
          <p className="exito-cola-resumen">
            #{exito.posicion}
            {exito.antesDeTi === 0
              ? " · Eres el siguiente"
              : ` · ${mensajeAntes(exito.antesDeTi, "pendiente")}`}
          </p>
          {(() => {
            const ahora = cola.find((c) => c.estado === "reproduciendo");
            if (!ahora || ahora.id === exito.id) return null;
            return (
              <div className="cola-panel cola-panel--compact">
                <div className="cola-linea">
                  <PlayIcon size={14} />
                  <div className="cola-linea-texto">
                    <span className="cola-linea-label">{es.cola.ahoraSuena}</span>
                    <span className="cola-linea-titulo">{ahora.titulo_cancion}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="exito-cola-acciones">
            {!bloqueado && (
              <button className="btn-primary" onClick={agregarOtra}>
                <AccionIcon size={18} /> {t.otra}
              </button>
            )}
            <button className="btn-secondary" onClick={onContinuar}>
              {t.irCarta} <ArrowRightIcon size={18} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {(tengoEnCola || cola.some((c) => c.estado === "reproduciendo")) && (
            <ColaClientePanel cola={cola} numeroMesa={numeroMesa} compacto />
          )}

          {textoCupo && (
            <p className="search-hint limite-cola-hint">{textoCupo}</p>
          )}

          {bloqueado && limiteCola && (
            <div className="error-msg" role="status">
              {mensajeLimiteUi(limiteCola, t)}
            </div>
          )}

          {!seleccionado && !bloqueado && (
            <>
              <div className="search-box">
                <div className="search-input">
                  <SearchIcon size={18} className="search-input-icon" />
                  <input
                    ref={busquedaInputRef}
                    placeholder={t.placeholderBusqueda}
                    value={query}
                    onChange={(e) => setQuery(validarBusqueda(e.target.value))}
                    maxLength={LIMITES.busqueda.max}
                    inputMode="search"
                    enterKeyHint="search"
                  />
                  <button
                    type="button"
                    className={`voice-search-btn ${escuchando ? "is-listening" : ""}`}
                    aria-label={escuchando ? "Detener búsqueda por voz" : "Buscar por voz"}
                    onClick={buscarPorVoz}
                  >
                    <MicIcon size={18} />
                  </button>
                  {(buscando || esperandoEscritura) && (
                    <span className="search-spinner" aria-label={buscando ? "Buscando" : "Esperando"} />
                  )}
                </div>
                {query.trim().length > 0 && query.trim().length < MIN_CARACTERES && (
                  <p className="search-hint">Mínimo {MIN_CARACTERES} letras</p>
                )}
                {query.trim().length >= MIN_CARACTERES && esperandoEscritura && (
                  <p className="search-hint">Cuando dejes de escribir…</p>
                )}
                {query.trim().length >= MIN_CARACTERES && buscando && (
                  <p className="search-hint">Buscando…</p>
                )}
                {query.trim().length >= MIN_CARACTERES && !esperandoEscritura && !buscando && resultados.length === 0 && !error && (
                  <p className="search-hint">Sin resultados</p>
                )}
              </div>

              <div className="results">
                {resultados.map((v) => (
                  <button
                    key={v.video_id}
                    type="button"
                    className="video-card video-card-pick"
                    onClick={() => elegirCancion(v)}
                  >
                    <img src={v.miniatura_url} alt="" />
                    <div className="info">
                      <div className="titulo">{v.titulo}</div>
                      {v.canal && <div className="canal">{v.canal}</div>}
                    </div>
                    <span className="video-pick-hint">Elegir</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {seleccionado && !bloqueado && (
            <div className="envio-cancion" ref={envioRef}>
              <div className="envio-cancion-elegida">
                <div className="envio-cancion-label">{t.elegida}</div>
                <div className="envio-cancion-card">
                  <img src={seleccionado.miniatura_url} alt="" />
                  <div className="info">
                    <div className="titulo">{seleccionado.titulo}</div>
                    {seleccionado.canal && <div className="canal">{seleccionado.canal}</div>}
                  </div>
                </div>
                <button type="button" className="btn-text" onClick={cambiarCancion}>
                  {t.cambiarCancion}
                </button>
              </div>

              <div className="saludo-box">
                <div className="saludo-box-head">
                  <HeartIcon size={18} />
                  <div className="saludo-box-titulo">{t.saludoTitulo}</div>
                </div>
                <textarea
                  value={saludo}
                  onChange={(e) => {
                    setError("");
                    setSaludo(e.target.value.slice(0, LIMITES.saludo.max));
                  }}
                  placeholder={t.saludoPlaceholder}
                  maxLength={LIMITES.saludo.max}
                  rows={2}
                />
                {saludo.trim() && (
                  <div className="saludo-momento">
                    <div className="saludo-momento-opts">
                      <button
                        type="button"
                        className={`saludo-momento-btn ${saludoMomento === "inicio" ? "active" : ""}`}
                        onClick={() => setSaludoMomento("inicio")}
                      >
                        {t.saludoInicio}
                      </button>
                      <button
                        type="button"
                        className={`saludo-momento-btn ${saludoMomento === "final" ? "active" : ""}`}
                        onClick={() => setSaludoMomento("final")}
                      >
                        {t.saludoFinal}
                      </button>
                    </div>
                  </div>
                )}
                <p className="saludo-limite">{saludo.length}/{LIMITES.saludo.max} · 1 saludo cada 3 min</p>
              </div>

              <button className="btn-primary" onClick={encolar} disabled={loading}>
                <AccionIcon size={18} />
                {loading
                  ? "Comprobando video…"
                  : (saludo.trim() ? t.enviar : t.enviarSinSaludo)}
              </button>
            </div>
          )}

          <button className="btn-secondary" onClick={onContinuar}>
            {t.irCarta} <ArrowRightIcon size={18} />
          </button>
        </>
      )}
    </div>
  );
}
