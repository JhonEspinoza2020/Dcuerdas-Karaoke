import { useCallback, useEffect, useState } from "react";
import { api } from "@dcuerdas/shared";

type Props = { accessToken: string };
type QR = { numero_mesa: number; url: string; etiqueta?: string };

function urlQrImagen(url: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

function nombreArchivoQr(q: QR): string {
  const fallback = `mesa-${q.numero_mesa}`;
  const nombre = (q.etiqueta ?? fallback)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  return `${nombre || fallback}-qr.png`;
}

async function descargarQr(q: QR): Promise<void> {
  const res = await fetch(urlQrImagen(q.url, 512));
  if (!res.ok) throw new Error("No se pudo generar el QR");
  const blob = await res.blob();
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombreArchivoQr(q);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(enlace.href);
}

export function QRsPanel({ accessToken }: Props) {
  const [qrs, setQrs] = useState<QR[]>([]);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState<number | null>(null);
  const [descargandoTodos, setDescargandoTodos] = useState(false);

  useEffect(() => {
    api.mesasQrs(accessToken)
      .then((data) => {
        if (Array.isArray(data)) setQrs(data);
      })
      .catch(() => setError("No se pudieron cargar los QR"));
  }, [accessToken]);

  const descargarUno = useCallback(async (q: QR) => {
    setDescargando(q.numero_mesa);
    setError("");
    try {
      await descargarQr(q);
    } catch {
      setError(`No se pudo descargar el QR de ${q.etiqueta ?? ("Mesa " + q.numero_mesa)}.`);
    } finally {
      setDescargando(null);
    }
  }, []);

  const descargarTodos = useCallback(async () => {
    if (qrs.length === 0) return;
    setDescargandoTodos(true);
    setError("");
    try {
      for (const q of qrs) {
        await descargarQr(q);
        await new Promise((r) => window.setTimeout(r, 350));
      }
    } catch {
      setError("No se pudieron descargar todos los QR. Intenta uno por uno.");
    } finally {
      setDescargandoTodos(false);
    }
  }, [qrs]);

  return (
    <div className="panel">
      <div className="qr-panel-head">
        <h2 className="panel-title">Códigos QR</h2>
        {qrs.length > 0 && (
          <button
            type="button"
            className="btn-secondary qr-download-all"
            disabled={descargandoTodos || descargando !== null}
            onClick={() => void descargarTodos()}
          >
            {descargandoTodos ? "Descargando…" : "Descargar todos"}
          </button>
        )}
      </div>
      <p className="qr-panel-hint">Imprime o guarda cada QR en el celular. Cada mesa tiene su propio enlace.</p>
      {error && <div className="error-msg">{error}</div>}
      <div className="qr-grid">
        {qrs.map((q) => {
          const nombre = q.etiqueta ?? `Mesa ${q.numero_mesa}`;
          const ocupado = descargando === q.numero_mesa || descargandoTodos;
          return (
            <div key={q.numero_mesa} className="qr-card">
              <div className="qr-mesa">{nombre}</div>
              <img
                src={urlQrImagen(q.url)}
                alt={`QR ${nombre}`}
                width={220}
                height={220}
              />
              <div className="qr-actions">
                <button
                  type="button"
                  className="btn-primary qr-download-btn"
                  disabled={ocupado}
                  onClick={() => void descargarUno(q)}
                >
                  {descargando === q.numero_mesa ? "Descargando…" : "Descargar PNG"}
                </button>
                <a className="qr-link" href={q.url} target="_blank" rel="noreferrer">
                  Abrir enlace
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
