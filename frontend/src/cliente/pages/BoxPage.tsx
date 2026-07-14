import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, es, registrarVisita, useAuth } from "@dcuerdas/shared";
import { RegistroStep } from "../components/RegistroStep";
import { CartaStep } from "../components/CartaStep";
import { KaraokeStep } from "../components/KaraokeStep";
import { BrandLogo } from "../../components/BrandLogo";
import { MicIcon, UtensilsIcon } from "../components/Icons";
import {
  type ClienteDatos,
  cargarDatos,
  guardarDatos,
} from "../types";

const DATOS_VACIOS: ClienteDatos = {
  nombre: "",
  numPersonas: "",
  notaCocina: "",
  telefono: "",
};

type Tab = "karaoke" | "carta";

export function BoxPage() {
  const { numero } = useParams<{ numero: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("t") ?? "";
  const numeroBox = Number(numero);

  const [mesaOk, setMesaOk] = useState(false);
  const [error, setError] = useState("");
  const [etiqueta, setEtiqueta] = useState("Box Karaoke");
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
    if (!numeroBox || !token) {
      setError(es.errores.tokenInvalido);
      return;
    }
    api.validarMesa(numeroBox, token)
      .then((info) => {
        if (info.tipo !== "karaoke") {
          navigate(`/mesa/${numeroBox}?t=${token}`, { replace: true });
          return;
        }
        setMesaOk(true);
        setEtiqueta(info.etiqueta ?? "Box Karaoke");
        const saved = cargarDatos(numeroBox);
        if (saved?.nombre) {
          setDatos(saved);
          setRegistrado(true);
        }
      })
      .catch(() => setError(es.errores.tokenInvalido));
  }, [numeroBox, token, navigate]);

  const continuarRegistro = () => {
    guardarDatos(numeroBox, datos);
    registrarVisita(numeroBox, token, datos.nombre, accessToken || undefined).catch(() => {});
    setRegistrado(true);
  };

  if (!numeroBox || !token) {
    return (
      <div className="app box-karaoke">
        <header className="header">
          <BrandLogo size="header" />
        </header>
        <div className="error-msg">{es.errores.tokenInvalido}</div>
      </div>
    );
  }

  return (
    <div className="app box-karaoke">
      <header className="header">
        <BrandLogo size="header" />
        <div className="mesa-badge box-badge"><MicIcon size={16} /> {etiqueta}</div>
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
              onClick={() => setTab("karaoke")}
            >
              <MicIcon size={18} /> {es.box.tabKaraoke}
            </button>
            <button
              type="button"
              className={tab === "carta" ? "active" : ""}
              onClick={() => setTab("carta")}
            >
              <UtensilsIcon size={18} /> {es.box.tabCarta}
            </button>
          </div>

          {tab === "karaoke" && (
            <KaraokeStep
              numeroMesa={numeroBox}
              token={token}
              nombre={datos.nombre}
              modo="karaoke"
              onContinuar={() => setTab("carta")}
            />
          )}

          {tab === "carta" && (
            <CartaStep
              numeroMesa={numeroBox}
              token={token}
              datos={datos}
              onPedidoEnviado={() => {}}
              onVolver={() => setTab("karaoke")}
            />
          )}
        </>
      )}
    </div>
  );
}
