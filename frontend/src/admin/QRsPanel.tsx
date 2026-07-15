import { useEffect, useState } from "react";
import { api } from "@dcuerdas/shared";

type Props = { accessToken: string };
type QR = { numero_mesa: number; url: string; etiqueta?: string };

export function QRsPanel({ accessToken }: Props) {
  const [qrs, setQrs] = useState<QR[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.mesasQrs(accessToken)
      .then((data) => {
        if (Array.isArray(data)) setQrs(data);
      })
      .catch(() => setError("No se pudieron cargar los QR"));
  }, [accessToken]);

  return (
    <div className="panel">
      <h2 className="panel-title">Códigos QR</h2>
      {error && <div className="error-msg">{error}</div>}
      <div className="qr-grid">
        {qrs.map((q) => {
          const nombre = q.etiqueta ?? `Mesa ${q.numero_mesa}`;
          return (
            <div key={q.numero_mesa} className="qr-card">
              <div className="qr-mesa">{nombre}</div>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(q.url)}`}
                alt={`QR ${nombre}`}
                width={220}
                height={220}
              />
              <a className="qr-link" href={q.url} target="_blank" rel="noreferrer">Abrir enlace</a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
