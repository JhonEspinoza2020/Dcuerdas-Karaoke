import { Link } from "react-router-dom";
import { es, useAuth } from "@dcuerdas/shared";
import { BrandLogo } from "../components/BrandLogo";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { LegalLinks } from "../components/LegalLinks";
import { limpiarModoCliente } from "../shared/clienteNav";
import { Reproductor } from "./Reproductor";
import { useEffect, useState } from "react";

/**
 * Pantalla dedicada del reproductor (ventana popup / TV).
 * Sin sidebar del admin — solo el player a pantalla.
 */
export function PantallaReproductor() {
  const { user, esAdmin, cargando, accessToken, loginGoogle, logout } = useAuth();
  const [logueando, setLogueando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    limpiarModoCliente();
  }, []);

  const entrarGoogle = async () => {
    setLogueando(true);
    setError("");
    try {
      await loginGoogle(`${window.location.origin}/admin/pantalla`);
    } catch {
      setError("No se pudo iniciar sesión con Google");
      setLogueando(false);
    }
  };

  useEffect(() => {
    if (user) setLogueando(false);
  }, [user]);

  if (cargando) {
    return (
      <div className="admin-login">
        <p className="panel-empty">Cargando...</p>
      </div>
    );
  }

  if (!user || !esAdmin) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <BrandLogo size="compact" />
          <h2>{es.auth.adminTitulo}</h2>
          <p className="admin-login-sub">Inicia sesión para abrir el reproductor.</p>
          <GoogleSignInButton onClick={entrarGoogle} disabled={logueando} />
          {user && !esAdmin && (
            <div className="error-msg" style={{ marginTop: 16 }}>
              {es.auth.sinPermisos}
            </div>
          )}
          {error && <div className="error-msg">{error}</div>}
          {user && !esAdmin && (
            <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={() => logout()}>
              {es.auth.cerrarSesion}
            </button>
          )}
          <Link to="/admin" className="admin-back-link">
            Volver al panel
          </Link>
          <LegalLinks className="admin-login-legal" />
        </div>
      </div>
    );
  }

  return (
    <div className="pantalla-reproductor">
      <Reproductor accessToken={accessToken} visible />
    </div>
  );
}
