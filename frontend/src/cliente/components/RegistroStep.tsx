import { useState } from "react";
import { es, useAuth } from "@dcuerdas/shared";
import type { ClienteDatos } from "../types";
import { ArrowRightIcon } from "./Icons";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

type Props = {
  datos: ClienteDatos;
  onChange: (d: ClienteDatos) => void;
  onContinuar: () => void;
  redirectUrl?: string;
};

export function RegistroStep({ datos, onChange, onContinuar, redirectUrl }: Props) {
  const { user, nombreMostrar, loginGoogle } = useAuth();
  const [modoInvitado, setModoInvitado] = useState(false);
  const [logueando, setLogueando] = useState(false);

  const nombreGoogle = nombreMostrar || datos.nombre;
  const validoInvitado = datos.nombre.trim().length >= 2;
  const validoGoogle = Boolean(user && nombreGoogle.trim().length >= 2);

  const entrarGoogle = async () => {
    setLogueando(true);
    try {
      await loginGoogle(redirectUrl ?? window.location.href);
    } finally {
      setLogueando(false);
    }
  };

  const continuarGoogle = () => {
    if (nombreGoogle.trim().length >= 2) {
      onChange({ ...datos, nombre: nombreGoogle.trim() });
      onContinuar();
    }
  };

  return (
    <div className="step-card">
      <h2 className="step-title">{es.registro.titulo}</h2>

      {!modoInvitado && !user && (
        <div className="auth-opciones">
          <GoogleSignInButton onClick={entrarGoogle} disabled={logueando} />
          <div className="auth-separador"><span>{es.auth.oSeparador}</span></div>
          <button type="button" className="btn-secondary" onClick={() => setModoInvitado(true)}>
            {es.auth.continuarInvitado}
          </button>
        </div>
      )}

      {user && !modoInvitado && (
        <div className="auth-google-ok">
          <p>{es.auth.hola}, <strong>{nombreGoogle}</strong></p>
          <button className="btn-primary" onClick={continuarGoogle} disabled={!validoGoogle}>
            {es.registro.continuar}
            <ArrowRightIcon size={18} />
          </button>
          <button type="button" className="btn-link" onClick={() => setModoInvitado(true)}>
            {es.auth.continuarInvitado}
          </button>
        </div>
      )}

      {modoInvitado && (
        <>
          <div className="field">
            <label>{es.registro.nombre}</label>
            <input
              value={datos.nombre}
              onChange={(e) => onChange({ ...datos, nombre: e.target.value })}
              placeholder={es.registro.placeholderNombre}
              maxLength={80}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && validoInvitado && onContinuar()}
            />
          </div>
          <button className="btn-primary" disabled={!validoInvitado} onClick={onContinuar}>
            {es.registro.continuar}
            <ArrowRightIcon size={18} />
          </button>
          {!user && (
            <button type="button" className="btn-link" onClick={() => setModoInvitado(false)}>
              {es.auth.continuarGoogle}
            </button>
          )}
        </>
      )}
    </div>
  );
}
