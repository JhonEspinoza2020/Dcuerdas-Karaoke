import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { es, useAuth } from "@dcuerdas/shared";
import { BrandLogo } from "./components/BrandLogo";
import { GoogleSignInButton } from "./components/GoogleSignInButton";
import { QrIcon } from "./admin/AdminIcons";

export function Landing() {
  const { user, esAdmin, cargando, loginGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const [logueando, setLogueando] = useState(false);
  const [error, setError] = useState("");

  const entrarGoogle = async () => {
    setLogueando(true);
    setError("");
    try {
      await loginGoogle(`${window.location.origin}/`);
    } catch {
      setError("No se pudo iniciar sesión con Google");
      setLogueando(false);
    }
  };

  return (
    <div className="landing">
      <BrandLogo size="hero" />
      <p className="landing-lema">{es.marca.lema}</p>
      <p className="landing-tagline">{es.marca.tagline}</p>

      <div className="landing-hub">
        <section className="landing-card">
          <div className="landing-card-icon">
            <QrIcon size={30} />
          </div>
          <h2>¿Eres cliente?</h2>
          <p>Escanea el código QR de tu mesa para pedir música, cantar y hacer tu pedido.</p>
          <span className="landing-card-badge">Acceso solo desde tu mesa</span>
        </section>

        <section className="landing-card landing-card--personal">
          <div className="landing-card-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 7h-9M14 17H5M17 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM7 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
            </svg>
          </div>
          <h2>Personal / Dueño</h2>

          {cargando && <p className="panel-empty">Cargando...</p>}

          {!cargando && !user && (
            <>
              <p>{es.auth.adminSub}</p>
              <GoogleSignInButton onClick={entrarGoogle} disabled={logueando} />
            </>
          )}

          {!cargando && user && esAdmin && (
            <>
              <p>
                {es.auth.hola}, <strong>{user.user_metadata?.full_name ?? user.email}</strong>
              </p>
              <button type="button" className="btn-primary landing-panel-btn" onClick={() => navigate("/admin")}>
                Entrar al panel
              </button>
              <button type="button" className="landing-logout" onClick={logout}>
                {es.auth.cerrarSesion}
              </button>
            </>
          )}

          {!cargando && user && !esAdmin && (
            <>
              <p className="error-msg">{es.auth.sinPermisos}</p>
              <small className="landing-email">{user.email}</small>
              <button type="button" className="landing-logout" onClick={logout}>
                {es.auth.cerrarSesion}
              </button>
            </>
          )}

          {error && <div className="error-msg">{error}</div>}
        </section>
      </div>
    </div>
  );
}
