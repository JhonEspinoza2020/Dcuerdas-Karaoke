import { useEffect, useState } from "react";
import {
  guardarAnuncioConfig,
  leerAnuncioConfig,
  pedirAnuncioAhora,
  type AnuncioConfig,
  type AnuncioModo,
} from "./anuncioConfig";

type Props = { readonly accessToken: string };

function plural(n: number, uno: string, varios: string) {
  return n === 1 ? uno : varios;
}

function textoEstadoAnuncio(cfg: AnuncioConfig): string {
  if (!cfg.activo) return "desactivado";
  if (cfg.modo === "canciones") {
    return `cada ${cfg.cadaCanciones} ${plural(cfg.cadaCanciones, "canción", "canciones")}`;
  }
  return `cada ${cfg.cadaMinutos} ${plural(cfg.cadaMinutos, "minuto", "minutos")}`;
}

function parseRango(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function AnunciosPanel({ accessToken: _accessToken }: Props) {
  const [cfg, setCfg] = useState<AnuncioConfig>(() => leerAnuncioConfig());
  const [ok, setOk] = useState("");
  const [probando, setProbando] = useState(false);
  /** Texto libre mientras escribe; se valida al blur / Guardar. */
  const [textoCanciones, setTextoCanciones] = useState(() => String(leerAnuncioConfig().cadaCanciones));
  const [textoMinutos, setTextoMinutos] = useState(() => String(leerAnuncioConfig().cadaMinutos));

  useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => setOk(""), 2500);
    return () => window.clearTimeout(t);
  }, [ok]);

  const guardar = (next: AnuncioConfig) => {
    const limpia = guardarAnuncioConfig(next);
    setCfg(limpia);
    setTextoCanciones(String(limpia.cadaCanciones));
    setTextoMinutos(String(limpia.cadaMinutos));
    setOk("Configuración guardada");
  };

  const setModo = (modo: AnuncioModo) => {
    guardar({ ...cfg, modo });
  };

  const confirmarCanciones = () => {
    const cadaCanciones = parseRango(textoCanciones, 1, 10, cfg.cadaCanciones);
    setTextoCanciones(String(cadaCanciones));
    if (cadaCanciones !== cfg.cadaCanciones) guardar({ ...cfg, cadaCanciones });
  };

  const confirmarMinutos = () => {
    const cadaMinutos = parseRango(textoMinutos, 1, 15, cfg.cadaMinutos);
    setTextoMinutos(String(cadaMinutos));
    if (cadaMinutos !== cfg.cadaMinutos) guardar({ ...cfg, cadaMinutos });
  };

  const sonarAhora = () => {
    setProbando(true);
    pedirAnuncioAhora();
    setOk("Anuncio enviado al reproductor…");
    window.setTimeout(() => setProbando(false), 800);
  };

  return (
    <div className="admin-panel anuncio-panel">
      <header className="admin-panel-head">
        <div>
          <span className="carta-admin-eyebrow">Audio del local</span>
          <h1>Anuncios</h1>
        </div>
      </header>

      {ok && <div className="carta-admin-success">{ok}</div>}

      <section className="admin-card">
        <div className="carta-section-head">
          <div>
            <span className="carta-section-kicker">Control</span>
            <h2>Cuándo suena el anuncio</h2>
          </div>
          <label className="carta-switch anuncio-switch">
            <input
              type="checkbox"
              checked={cfg.activo}
              onChange={(e) => guardar({ ...cfg, activo: e.target.checked })}
            />
            <span className="carta-switch-track" aria-hidden="true" />
            <em>{cfg.activo ? "Activo" : "Pausado"}</em>
          </label>
        </div>

        <p className="anuncio-help">
          El anuncio (<code>anuncio.mp3</code>) suena en el <strong>Reproductor</strong>
          (abre esa pestaña al menos una vez). Aplica a cola y radio ambiente.
          Hoy: {textoEstadoAnuncio(cfg)}.
        </p>

        <div className="anuncio-modo-grid">
          <button
            type="button"
            className={`anuncio-modo-card ${cfg.modo === "canciones" ? "is-on" : ""}`}
            onClick={() => setModo("canciones")}
          >
            <strong>Por canciones</strong>
            <span>Después de N temas (cola o radio ambiente)</span>
          </button>
          <button
            type="button"
            className={`anuncio-modo-card ${cfg.modo === "minutos" ? "is-on" : ""}`}
            onClick={() => setModo("minutos")}
          >
            <strong>Por tiempo</strong>
            <span>Cada ciertos minutos con el reproductor en sesión</span>
          </button>
        </div>

        {cfg.modo === "canciones" ? (
          <label className="carta-field anuncio-field">
            <span>Después de cuántas canciones (1–10)</span>
            <input
              type="number"
              min={1}
              max={10}
              inputMode="numeric"
              value={textoCanciones}
              onChange={(e) => setTextoCanciones(e.target.value)}
              onBlur={confirmarCanciones}
            />
          </label>
        ) : (
          <label className="carta-field anuncio-field">
            <span>Cada cuántos minutos (1–15)</span>
            <input
              type="number"
              min={1}
              max={15}
              inputMode="numeric"
              value={textoMinutos}
              onChange={(e) => setTextoMinutos(e.target.value)}
              onBlur={confirmarMinutos}
            />
          </label>
        )}

        <div className="anuncio-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const cadaCanciones = parseRango(textoCanciones, 1, 10, cfg.cadaCanciones);
              const cadaMinutos = parseRango(textoMinutos, 1, 15, cfg.cadaMinutos);
              guardar({ ...cfg, cadaCanciones, cadaMinutos });
            }}
          >
            Guardar
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={probando}
            onClick={sonarAhora}
          >
            {probando ? "Reproduciendo…" : "Sonar ahora"}
          </button>
        </div>
      </section>
    </div>
  );
}
