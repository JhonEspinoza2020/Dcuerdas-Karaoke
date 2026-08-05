import { useCallback, useEffect, useRef, useState } from "react";
import { api, speechRecognitionSupported, startVoiceSearch, type VideoResult } from "@dcuerdas/shared";
import { MicIcon, SearchIcon } from "../cliente/components/Icons";
import { verificarEmbedYoutube } from "../cliente/verificarEmbedYoutube";
import { YoutubeAttribution } from "../components/YoutubeAttribution";

type Props = { readonly accessToken: string };

const DEBOUNCE_MS = 900;
const MIN = 3;

export function AdminBuscadorMusica({ accessToken }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<VideoResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [bloqueados, setBloqueados] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const detenerVozRef = useRef<(() => void) | null>(null);
  /** Última query que ya se consultó (evita re-buscar al reabrir la lupa). */
  const queryBuscadaRef = useRef("");

  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [abierto]);

  useEffect(() => {
    return () => detenerVozRef.current?.();
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [abierto]);

  // Solo depende de `query`: reabrir la lupa NO dispara otra búsqueda.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN) {
      setResultados([]);
      setBuscando(false);
      setEsperando(false);
      queryBuscadaRef.current = "";
      return;
    }

    // Misma palabra ya buscada → mostrar caché en memoria, sin API.
    if (q === queryBuscadaRef.current) {
      setEsperando(false);
      setBuscando(false);
      return;
    }

    setEsperando(true);
    setBuscando(false);
    setError("");
    const timer = window.setTimeout(async () => {
      setEsperando(false);
      setBuscando(true);
      try {
        const res = await api.adminBuscarYoutube(accessToken, q);
        queryBuscadaRef.current = q;
        setResultados(res.resultados ?? []);
      } catch (e) {
        setResultados([]);
        queryBuscadaRef.current = "";
        setError(e instanceof Error ? e.message : "Error al buscar");
      } finally {
        setBuscando(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, accessToken]);

  const encolar = useCallback(async (v: VideoResult) => {
    if (bloqueados.has(v.video_id)) return;
    setEnviando(v.video_id);
    setError("");
    setOkMsg("");
    try {
      const ok = await verificarEmbedYoutube(v.video_id);
      if (!ok) {
        api.marcarYoutubeBloqueado(accessToken, v.video_id, "admin_preflight").catch(() => {});
        setBloqueados((prev) => new Set(prev).add(v.video_id));
        setError("Ese no se puede embeber. Prueba otra versión de la lista.");
        return;
      }
      const res = await api.adminEncolarCancion(accessToken, {
        youtube_video_id: v.video_id,
        titulo_cancion: v.titulo,
        nombre_cliente: "Local",
      });
      setOkMsg(`En cola #${res.posicion ?? "?"}: ${v.titulo}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo encolar";
      setError(msg);
      if (/no se puede reproducir|bloquea|video_no_reproducible/i.test(msg)) {
        setBloqueados((prev) => new Set(prev).add(v.video_id));
      }
    } finally {
      setEnviando(null);
    }
  }, [accessToken, bloqueados]);

  const buscarPorVoz = () => {
    if (!speechRecognitionSupported()) {
      setError("Este navegador no permite búsqueda por voz.");
      return;
    }
    if (escuchando) {
      detenerVozRef.current?.();
      setEscuchando(false);
      return;
    }
    setAbierto(true);
    setError("");
    detenerVozRef.current = startVoiceSearch({
      onStart: () => setEscuchando(true),
      onEnd: () => setEscuchando(false),
      onError: () => {
        setEscuchando(false);
        setError("No se pudo escuchar. Revisa el permiso del micrófono.");
      },
      onResult: (text) => {
        setQuery(text);
        inputRef.current?.blur();
      },
    });
  };

  return (
    <div className="admin-buscador-wrap" ref={panelRef}>
      <button
        type="button"
        className={`btn-secondary rc-btn admin-buscador-lupa ${abierto ? "is-open" : ""}`}
        aria-label="Buscar música"
        aria-expanded={abierto}
        onClick={() => {
          setOkMsg("");
          setError("");
          setAbierto((a) => !a);
        }}
      >
        <SearchIcon size={18} />
      </button>

      {abierto && (
        <div className="admin-buscador-popover" role="dialog" aria-label="Buscar música">
          <div className="admin-buscador-input-row">
            <input
              ref={inputRef}
              className="admin-buscador-input"
              placeholder="Canción o artista…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className={`voice-search-btn admin-voice-btn ${escuchando ? "is-listening" : ""}`}
              aria-label={escuchando ? "Detener búsqueda por voz" : "Buscar por voz"}
              onClick={buscarPorVoz}
            >
              <MicIcon size={18} />
            </button>
          </div>
          {esperando && <p className="search-hint">Cuando dejes de escribir…</p>}
          {buscando && <p className="search-hint">Buscando…</p>}
          {error && <div className="error-msg">{error}</div>}
          {okMsg && <p className="admin-buscador-ok">{okMsg}</p>}

          <div className="admin-buscador-lista">
            {resultados.length > 0 && <YoutubeAttribution soloMarca />}
            {resultados.map((v) => {
              const malo = bloqueados.has(v.video_id);
              let etiquetaBtn = malo ? "No" : "Añadir";
              if (enviando === v.video_id) etiquetaBtn = "…";
              return (
                <div
                  key={v.video_id}
                  className={`admin-buscador-item ${malo ? "is-blocked" : ""}`}
                >
                  {v.miniatura_url ? (
                    <img src={v.miniatura_url} alt="" width={120} height={70} />
                  ) : (
                    <div className="admin-buscador-ph" />
                  )}
                  <div className="admin-buscador-info">
                    <div className="admin-buscador-cancion">{v.titulo}</div>
                    {v.canal && <div className="admin-buscador-canal">{v.canal}</div>}
                    {malo && <div className="admin-buscador-canal">No reproducible aquí</div>}
                    <YoutubeAttribution videoId={v.video_id} />
                  </div>
                  <button
                    type="button"
                    className="btn-primary rc-btn"
                    disabled={malo || enviando === v.video_id}
                    onClick={() => encolar(v)}
                  >
                    {etiquetaBtn}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
