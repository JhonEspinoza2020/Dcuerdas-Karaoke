import { useState } from "react";
import {
  es,
  useAuth,
  validarNombre,
  sanitizarInput,
  LIMITES,
  COOLDOWNS,
  msRestantesRateLimit,
  marcarRateLimit,
  formatearEspera,
} from "@dcuerdas/shared";
import type { ClienteDatos } from "../types";
import { ArrowRightIcon } from "./Icons";
import { GoogleSignInButton } from "../../components/GoogleSignInButton";

type Props = {
  datos: ClienteDatos;
  onChange: (d: ClienteDatos) => void;
  onContinuar: (finales: ClienteDatos) => void;
  redirectUrl?: string;
};

export function RegistroStep({ datos, onChange, onContinuar, redirectUrl }: Props) {
  const { user, nombreMostrar, loginGoogle } = useAuth();
  const [modoInvitado, setModoInvitado] = useState(false);
  const [logueando, setLogueando] = useState(false);
  const [error, setError] = useState("");

  const nombreGoogle = nombreMostrar || datos.nombre;
  const checkInvitado = validarNombre(datos.nombre);
  const checkGoogle = validarNombre(nombreGoogle);
  const validoInvitado = checkInvitado.ok;
  const validoGoogle = Boolean(user && checkGoogle.ok);

  const entrarGoogle = async () => {
    setLogueando(true);
    try {
      await loginGoogle(redirectUrl ?? window.location.href);
    } finally {
      setLogueando(false);
    }
  };

  const intentarContinuar = (nombreRaw: string) => {
    const check = validarNombre(nombreRaw);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    const espera = msRestantesRateLimit("registro", COOLDOWNS.registroMs);
    if (espera > 0) {
      setError(`Espera ${formatearEspera(espera)}.`);
      return;
    }
    marcarRateLimit("registro");
    setError("");
    const finales = { ...datos, nombre: check.valor };
    onChange(finales);
    onContinuar(finales);
  };

  const continuarGoogle = () => {
    intentarContinuar(nombreGoogle);
  };

  return (
    <div className="step-card">
      <h2 className="step-title">{es.registro.titulo}</h2>

      {error && <div className="error-msg" role="alert">{error}</div>}

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
              onChange={(e) => {
                setError("");
                onChange({
                  ...datos,
                  nombre: sanitizarInput(e.target.value, LIMITES.nombre.max),
                });
              }}
              placeholder={es.registro.placeholderNombre}
              maxLength={LIMITES.nombre.max}
              autoComplete="name"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && validoInvitado && intentarContinuar(datos.nombre)}
            />
            <p className="field-hint">{datos.nombre.trim().length}/{LIMITES.nombre.max}</p>
          </div>
          <button
            className="btn-primary"
            disabled={!validoInvitado}
            onClick={() => intentarContinuar(datos.nombre)}
          >
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
