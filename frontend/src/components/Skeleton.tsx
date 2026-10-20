import { useEffect, useState } from "react";

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
};

function medida(valor: string | number): string {
  return typeof valor === "number" ? `${valor}px` : valor;
}

export function Skeleton({
  width = "100%",
  height = 14,
  radius = 8,
  className = "",
}: SkeletonProps) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{
        width: medida(width),
        height: medida(height),
        borderRadius: medida(radius),
      }}
      aria-hidden="true"
    />
  );
}

type FilasProps = {
  filas?: number;
  conAvatar?: boolean;
};

/** Solo aparece si la carga sigue después de un momento. Las respuestas rápidas no parpadean. */
export function useEsqueletoSiDemora(cargando: boolean, esperaMs = 320): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!cargando) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), esperaMs);
    return () => window.clearTimeout(timer);
  }, [cargando, esperaMs]);
  return visible;
}

export function SkeletonRows({ filas = 6, conAvatar = false }: FilasProps) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="skeleton-row">
          {conAvatar && <Skeleton width={36} height={36} radius={10} />}
          <div className="skeleton-row-text">
            <Skeleton width={`${72 - (i % 3) * 14}%`} height={14} />
            <Skeleton width={`${42 + (i % 4) * 8}%`} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
