import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, es, registrarVisita, useAuth, type KaraokeEstado, type TipoZona } from "@dcuerdas/shared";
import { RegistroStep } from "../components/RegistroStep";
import { CartaStep } from "../components/CartaStep";
import { KaraokeStep } from "../components/KaraokeStep";
import { BrandLogo } from "../../components/BrandLogo";
import { MusicIcon, UtensilsIcon } from "../components/Icons";
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
  const navigate = useNavigate();
  const token = searchParams.get("t") ?? "";
  const numeroMesa = Number(numero);

  const [estado, setEstado] = useState<KaraokeEstado | null>(null);
  const [mesaOk, setMesaOk] = useState(false);
  const [tipo, setTipo] = useState<TipoZona>("mesa");
  const [etiquetaMesa, setEtiquetaMesa] = useState("");
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
    if (!numeroMesa || !token) {
      setError(es.errores.tokenInvalido);
      return;
    }
    api.validarMesa(numeroMesa, token)
      .then((info) => {
        if (info.tipo === "karaoke") {
          navigate(`/box/${numeroMesa}?t=${token}`, { replace: true });
          return;
        }
        setMesaOk(true);
        setTipo(info.tipo);
        setEtiquetaMesa(info.etiqueta ?? `Mesa ${info.numero_mesa}`);
        const saved = cargarDatos(numeroMesa);
        if (saved?.nombre?.trim()) {
          setDatos(saved);
          setRegistrado(true);
          const previo = cargarPaso(numeroMesa);
          setTab(previo === "carta" ? "carta" : "karaoke");
        }
      })
      .catch(() => setError(es.errores.tokenInvalido));
  }, [numeroMesa, token, navigate]);

  const irA = (nuevo: Tab) => {
    setTab(nuevo);
    guardarPaso(numeroMesa, nuevo as Paso);
  };

  const continuarRegistro = () => {
    guardarDatos(numeroMesa, datos);
    registrarVisita(numeroMesa, token, datos.nombre, accessToken || undefined).catch(() => {});
    setRegistrado(true);
    irA("karaoke");
  };

  const badge = etiquetaMesa || `Mesa ${numeroMesa}`;
  const tabMusica = tipo === "karaoke" ? es.karaoke.pasoLabel : es.musica.pasoLabel;

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
        {mesaOk && <div className="mesa-badge">{badge}</div>}
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
              <MusicIcon size={18} /> {tabMusica}
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
              modo={tipo}
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
