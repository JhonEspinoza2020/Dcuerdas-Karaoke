  import { useCallback, useEffect, useRef, useState } from "react";
import { api, es, supabase, type TipoZona, type VideoResult } from "@dcuerdas/shared";
import { ColaClientePanel, mensajeAntes, type ColaPublicaItem } from "./ColaClientePanel";
import { MusicIcon, SearchIcon, HeartIcon, ArrowRightIcon, CheckIcon, PlayIcon } from "./Icons";
import { verificarEmbedYoutube } from "../verificarEmbedYoutube";

/** Espera a que el usuario deje de escribir antes de pegarle a YouTube. */
const DEBOUNCE_MS = 900;
const MIN_CARACTERES = 3;

type Props = {
  numeroMesa: number;
  token: string;
  nombre: string;
  modo: TipoZona;
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
  const [exito, setExito] = useState<ExitoState | null>(null);
  const [cola, setCola] = useState<ColaPublicaItem[]>([]);
  const envioRef = useRef<HTMLDivElement | null>(null);
  const busquedaIdRef = useRef(0);

  const actualizarCola = useCallback(async () => {
    const { data } = await supabase
      .from("cola_publica")
      .select("id, numero_mesa, etiqueta, tipo, titulo_cancion, nombre_cliente, estado")
      .order("creado_en");
    if (data) setCola(data as ColaPublicaItem[]);
  }, []);

  useEffect(() => {
    actualizarCola();
    const channel = supabase
      .channel(`cola-mesa-${numeroMesa}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cola_reproduccion" }, () => {
        actualizarCola();
      })
      .subscribe();
    const intervalo = window.setInterval(actualizarCola, 8000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(intervalo);
    };
  }, [numeroMesa, actualizarCola]);

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

    // Mientras escribe: no llamar API.
    setEsperandoEscritura(true);
    setBuscando(false);
    setError("");

    const timer = window.setTimeout(async () => {
      if (busquedaIdRef.current !== idBusqueda) return;
      setEsperandoEscritura(false);
      setBuscando(true);
      try {
        const res = await api.buscarYoutube(numeroMesa, token, q, modo);
        if (busquedaIdRef.current !== idBusqueda) return;
        setResultados(res.resultados);
      } catch (e) {
        if (busquedaIdRef.current !== idBusqueda) return;
        setResultados([]);
        setError(e instanceof Error ? e.message : "Error al buscar");
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

  const cambiarCancion = () => {
    setSeleccionado(null);
    setSaludo("");
    setSaludoMomento("inicio");
  };

  const encolar = useCallback(async () => {
    if (!seleccionado) return;
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
        return;
      }

      const res = await api.encolarCancion({
        numero_mesa: numeroMesa,
        token,
        youtube_video_id: seleccionado.video_id,
        titulo_cancion: seleccionado.titulo,
        nombre_cliente: nombre,
        saludo: saludo.trim() || undefined,
        saludo_momento: saludo.trim() ? saludoMomento : undefined,
      });
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
      }
    } finally {
      setLoading(false);
    }
  }, [seleccionado, saludo, saludoMomento, nombre, numeroMesa, token, actualizarCola]);

  const agregarOtra = () => {
    setExito(null);
    setSeleccionado(null);
  };

  const tengoEnCola = cola.some((c) => c.numero_mesa === numeroMesa);

  return (
    <div className="step-card">
      <h2 className="step-title"><AccionIcon size={24} /> {t.paso}</h2>

      {error && <div className="error-msg">{error}</div>}

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
            <button className="btn-primary" onClick={agregarOtra}>
              <AccionIcon size={18} /> {t.otra}
            </button>
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

          {!seleccionado && (
            <>
              <div className="search-box">
                <div className="search-input">
                  <SearchIcon size={18} className="search-input-icon" />
                  <input
                    placeholder={t.placeholderBusqueda}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
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

          {seleccionado && (
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
                  onChange={(e) => setSaludo(e.target.value.slice(0, 140))}
                  placeholder={t.saludoPlaceholder}
                  maxLength={140}
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
                <p className="saludo-limite">{saludo.length}/140</p>
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
