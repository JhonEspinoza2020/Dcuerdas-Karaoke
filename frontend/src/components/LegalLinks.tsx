import { Link, useLocation } from "react-router-dom";
import { guardarRutaVolver } from "../shared/clienteNav";

type Props = {
  className?: string;
};

/** Enlace a la política de privacidad (requerido por YouTube API ToS). */
export function LegalLinks({ className = "" }: Props) {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  return (
    <nav className={`legal-links ${className}`.trim()} aria-label="Legal">
      <Link
        to="/privacidad"
        state={{ from }}
        onClick={() => guardarRutaVolver(from)}
      >
        Privacidad
      </Link>
    </nav>
  );
}
