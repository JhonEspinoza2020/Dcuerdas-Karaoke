import { useEffect, useState } from "react";
import {
  guardarAnuncioConfig,
  leerAnuncioConfig,
  pedirAnuncioAhora,
  type AnuncioConfig,
  type AnuncioModo,
} from "./anuncioConfig";

type Props = { readonly accessToken: string };

export function AnunciosPanel({ accessToken: _accessToken }: Props) {
  const [cfg, setCfg] = useState<AnuncioConfig>(() => leerAnuncioConfig());
  const [ok, setOk] = useState("");
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => setOk(""), 2500);
    return () => window.clearTimeout(t);
  }, [ok]);

  const guardar = (next: AnuncioConfig) => {
    const limpia = guardarAnuncioConfig(next);
    setCfg(limpia);
    setOk("Configuración guardada");
  };

  const setModo = (modo: AnuncioModo) => {
    guardar({ ...cfg, modo });
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
          Hoy: {cfg.activo
            ? cfg.modo === "canciones"
              ? `cada ${cfg.cadaCanciones} canción${cfg.cadaCanciones === 1 ? "" : "es"}`
              : `cada ${cfg.cadaMinutos} minuto${cfg.cadaMinutos === 1 ? "" : "s"}`
            : "desactivado"}.
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
              value={cfg.cadaCanciones}
              onChange={(e) => {
                const cadaCanciones = Math.min(10, Math.max(1, Number(e.target.value) || 1));
                setCfg((c) => ({ ...c, cadaCanciones }));
              }}
              onBlur={(e) => {
                const cadaCanciones = Math.min(10, Math.max(1, Number(e.target.value) || 1));
                guardar({ ...cfg, cadaCanciones });
              }}
            />
          </label>
        ) : (
          <label className="carta-field anuncio-field">
            <span>Cada cuántos minutos (1–15)</span>
            <input
              type="number"
              min={1}
              max={15}
              value={cfg.cadaMinutos}
              onChange={(e) => {
                const cadaMinutos = Math.min(15, Math.max(1, Number(e.target.value) || 1));
                setCfg((c) => ({ ...c, cadaMinutos }));
              }}
              onBlur={(e) => {
                const cadaMinutos = Math.min(15, Math.max(1, Number(e.target.value) || 1));
                guardar({ ...cfg, cadaMinutos });
              }}
            />
          </label>
        )}

        <div className="anuncio-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => guardar(cfg)}
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
