import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, es, registrarVisita, useAuth, type KaraokeEstado } from "@dcuerdas/shared";
import { RegistroStep } from "../components/RegistroStep";
import { CartaStep } from "../components/CartaStep";
import { KaraokeStep } from "../components/KaraokeStep";
import { BrandLogo } from "../../components/BrandLogo";
import { LegalLinks } from "../../components/LegalLinks";
import { MusicIcon, UtensilsIcon } from "../components/Icons";
import { marcarModoCliente } from "../../shared/clienteNav";
import {
  type ClienteDatos,
  type Paso,
  cargarDatos,
  cargarPaso,
  guardarDatos,
  guardarPaso,
} from "../types";

const DATOS_VACIOS: ClienteDatos = {
  nombre: "",
  numPersonas: "",
  notaCocina: "",
  telefono: "",
};

type Tab = "karaoke" | "carta";

export function MesaPage() {
  const { numero } = useParams<{ numero: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t") ?? "";
  const numeroMesa = Number(numero);

  const [estado, setEstado] = useState<KaraokeEstado | null>(null);
  const [mesaOk, setMesaOk] = useState(false);
  const [error, setError] = useState("");
  const [datos, setDatos] = useState<ClienteDatos>(DATOS_VACIOS);
  const [registrado, setRegistrado] = useState(false);
  const [tab, setTab] = useState<Tab>("karaoke");
  const { accessToken, nombreMostrar, user } = useAuth();

  useEffect(() => {
    if (user && nombreMostrar && !datos.nombre.trim()) {
      setDatos((d) => ({ ...d, nombre: nombreMostrar }));
    }
  }, [user, nombreMostrar, datos.nombre]);

  useEffect(() => {
    api.karaokeEstado().then(setEstado).catch(() => {});
  }, []);

  useEffect(() => {
    if (!numeroMesa || !token) return;
    marcarModoCliente(`/mesa/${numeroMesa}?t=${encodeURIComponent(token)}`);
  }, [numeroMesa, token]);

  useEffect(() => {
    if (!numeroMesa || !token) {
      setError(es.errores.tokenInvalido);
      return;
    }
    if (numeroMesa < 1 || numeroMesa > 12) {
      setError(es.errores.tokenInvalido);
      return;
    }
    api.validarMesa(numeroMesa, token)
      .then((info) => {
        if (info.tipo === "karaoke") {
          setError("Esta zona ya no está disponible.");
          return;
        }
        setMesaOk(true);
        const saved = cargarDatos(numeroMesa);
        if (saved?.nombre?.trim()) {
          setDatos(saved);
          setRegistrado(true);
          const previo = cargarPaso(numeroMesa);
          setTab(previo === "carta" ? "carta" : "karaoke");
        }
      })
      .catch(() => setError(es.errores.tokenInvalido));
  }, [numeroMesa, token]);

  const irA = (nuevo: Tab) => {
    setTab(nuevo);
    guardarPaso(numeroMesa, nuevo as Paso);
  };

  const continuarRegistro = (finales: ClienteDatos) => {
    setDatos(finales);
    guardarDatos(numeroMesa, finales);
    registrarVisita(numeroMesa, token, finales.nombre, accessToken || undefined).catch(() => {});
    setRegistrado(true);
    irA("karaoke");
  };

  if (!numeroMesa || !token) {
    return (
      <div className="app">
        <header className="header">
          <BrandLogo size="header" />
        </header>
        <div className="error-msg">{es.errores.tokenInvalido}</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <BrandLogo size="header" />
        {mesaOk && <div className="mesa-badge">Mesa {numeroMesa}</div>}
        <LegalLinks className="mesa-legal" />
      </header>

      {error && <div className="error-msg">{error}</div>}

      {mesaOk && !registrado && (
        <RegistroStep
          datos={datos}
          onChange={setDatos}
          onContinuar={continuarRegistro}
        />
      )}

      {mesaOk && registrado && (
        <>
          <div className="box-tabs">
            <button
              type="button"
              className={tab === "karaoke" ? "active" : ""}
              onClick={() => irA("karaoke")}
            >
              <MusicIcon size={18} /> {es.musica.pasoLabel}
            </button>
            <button
              type="button"
              className={tab === "carta" ? "active" : ""}
              onClick={() => irA("carta")}
            >
              <UtensilsIcon size={18} /> {es.carta.titulo}
            </button>
          </div>

          {estado && tab === "karaoke" && !estado.abierto && (
            <div className="status-banner cerrado">
              {es.karaoke.cerrado}
            </div>
          )}

          {tab === "karaoke" && (
            <KaraokeStep
              numeroMesa={numeroMesa}
              token={token}
              nombre={datos.nombre}
              modo="musica"
              onContinuar={() => irA("carta")}
            />
          )}

          {tab === "carta" && (
            <CartaStep
              numeroMesa={numeroMesa}
              token={token}
              datos={datos}
              onPedidoEnviado={() => {}}
              onVolver={() => irA("karaoke")}
            />
          )}
        </>
      )}
    </div>
  );
}
