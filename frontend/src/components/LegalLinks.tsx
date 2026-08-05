import { Link } from "react-router-dom";

type Props = {
  className?: string;
};

/** Enlace a la política de privacidad (requerido por YouTube API ToS). */
export function LegalLinks({ className = "" }: Props) {
  return (
    <nav className={`legal-links ${className}`.trim()} aria-label="Legal">
      <Link to="/privacidad">Privacidad</Link>
    </nav>
  );
}
