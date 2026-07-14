import { useState } from "react";
import { Link } from "react-router-dom";
import { es, useAuth } from "@dcuerdas/shared";
import { Reproductor } from "./Reproductor";
import { ColaPanel } from "./ColaPanel";
import { QRsPanel } from "./QRsPanel";
import { DashboardPanel } from "./DashboardPanel";
import { ClientesPanel } from "./ClientesPanel";
import { PedidosPanel } from "./PedidosPanel";
import { BrandLogo } from "../components/BrandLogo";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import {
  DashboardIcon,
  UsersIcon,
  QueueIcon,
  TvIcon,
  QrIcon,
  OrderIcon,
  LogoutIcon,
} from "./AdminIcons";

type Tab = "dashboard" | "clientes" | "pedidos" | "cola" | "reproductor" | "qrs";

const NAV: { id: Tab; label: string; icon: typeof DashboardIcon }[] = [
  { id: "dashboard", label: "Resumen", icon: DashboardIcon },
  { id: "clientes", label: "Clientes", icon: UsersIcon },
  { id: "pedidos", label: "Pedidos", icon: OrderIcon },
  { id: "cola", label: "Cola", icon: QueueIcon },
  { id: "reproductor", label: "Reproductor", icon: TvIcon },
  { id: "qrs", label: "Códigos QR", icon: QrIcon },
];

export function AdminApp() {
  const { user, esAdmin, cargando, accessToken, loginGoogle, logout, perfil } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState("");
  const [logueando, setLogueando] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  const entrarGoogle = async () => {
    setLogueando(true);
    setError("");
    try {
      await loginGoogle(`${window.location.origin}/admin`);
    } catch {
      setError("No se pudo iniciar sesión con Google");
      setLogueando(false);
    }
  };

  const salir = async () => {
    await logout();
    setTab("dashboard");
  };

  const irA = (id: Tab) => {
    setTab(id);
    setSidebarAbierto(false);
  };

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
          <p className="admin-login-sub">{es.auth.adminSub}</p>

          <GoogleSignInButton onClick={entrarGoogle} disabled={logueando} />

          {user && !esAdmin && (
            <div className="error-msg" style={{ marginTop: 16 }}>
              {es.auth.sinPermisos}
              <br />
              <small>{user.email}</small>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          {user && !esAdmin && (
            <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={salir}>
              {es.auth.cerrarSesion}
            </button>
          )}

          <Link to="/" className="admin-back-link">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarAbierto ? "open" : ""}`}>
        <div className="admin-sidebar-brand">
          <BrandLogo size="nav" />
          <div className="admin-user-mini">
            <span className="admin-sidebar-titulo">Panel</span>
            <span className="admin-user-email">{perfil?.nombre ?? user.email}</span>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => irA(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button type="button" className="admin-sidebar-logout" onClick={salir}>
          <LogoutIcon size={18} />
          <span>{es.auth.cerrarSesion}</span>
        </button>
      </aside>

      {sidebarAbierto && (
        <button
          type="button"
          className="admin-sidebar-overlay"
          aria-label="Cerrar menú"
          onClick={() => setSidebarAbierto(false)}
        />
      )}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-btn"
            onClick={() => setSidebarAbierto(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <span className="admin-topbar-titulo">
            {NAV.find((n) => n.id === tab)?.label ?? "Admin"}
          </span>
        </header>

        <main className="admin-content">
          {tab === "dashboard" && <DashboardPanel accessToken={accessToken} />}
          {tab === "clientes" && <ClientesPanel accessToken={accessToken} />}
          {tab === "pedidos" && <PedidosPanel accessToken={accessToken} />}
          {tab === "cola" && <ColaPanel accessToken={accessToken} />}
          {tab === "qrs" && <QRsPanel accessToken={accessToken} />}
          {/* El reproductor permanece montado para no cortar la música al navegar. */}
          <div
            className={tab === "reproductor" ? "" : "repro-persist--hidden"}
            aria-hidden={tab !== "reproductor"}
          >
            <Reproductor accessToken={accessToken} />
          </div>
        </main>
      </div>
    </div>
  );
}
