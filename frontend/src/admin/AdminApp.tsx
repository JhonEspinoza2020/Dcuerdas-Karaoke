import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, api, es, supabase, useAuth } from "@dcuerdas/shared";
import { Reproductor } from "./Reproductor";
import { ColaPanel } from "./ColaPanel";
import { QRsPanel } from "./QRsPanel";
import { DashboardPanel } from "./DashboardPanel";
import { ClientesPanel } from "./ClientesPanel";
import { PedidosPanel } from "./PedidosPanel";
import { CartaPanel } from "./CartaPanel";
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
  SoundWaveSilhouette,
  MenuIcon,
} from "./AdminIcons";

type Tab = "dashboard" | "clientes" | "pedidos" | "carta" | "cola" | "reproductor" | "qrs";

const NAV: { id: Tab; label: string; icon: typeof DashboardIcon }[] = [
  { id: "dashboard", label: "Resumen", icon: DashboardIcon },
  { id: "pedidos", label: "Pedidos", icon: OrderIcon },
  { id: "cola", label: "Cola", icon: QueueIcon },
  { id: "reproductor", label: "Reproductor", icon: TvIcon },
  { id: "clientes", label: "Clientes", icon: UsersIcon },
  { id: "carta", label: "Carta", icon: MenuIcon },
  { id: "qrs", label: "Códigos QR", icon: QrIcon },
];

export function AdminApp() {
  const { user, esAdmin, cargando, accessToken, loginGoogle, logout, perfil } = useAuth();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [error, setError] = useState("");
  const [logueando, setLogueando] = useState(false);
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [musicaSonando, setMusicaSonando] = useState(false);
  const [pedidosActivos, setPedidosActivos] = useState(0);
  const [colaActiva, setColaActiva] = useState(0);

  const cargarPedidosBadge = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await adminApi.pedidos(accessToken);
      if (!Array.isArray(data)) return;
      const n = data.filter(
        (p) => p.estado === "pendiente" || p.estado === "en_preparacion" || p.estado === "listo",
      ).length;
      setPedidosActivos(n);
    } catch {
      /* silencioso: el badge no debe romper el panel */
    }
  }, [accessToken]);

  const cargarColaBadge = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await api.colaActiva(accessToken);
      if (!Array.isArray(data)) {
        setColaActiva(0);
        return;
      }
      setColaActiva(
        data.filter((c) => c.estado === "pendiente" || c.estado === "reproduciendo").length,
      );
    } catch {
      setColaActiva(0);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!esAdmin || !accessToken) return;
    let badgeTimer = 0;
    const refreshBadges = () => {
      window.clearTimeout(badgeTimer);
      badgeTimer = window.setTimeout(() => {
        cargarPedidosBadge();
        cargarColaBadge();
      }, 200);
    };
    cargarPedidosBadge();
    cargarColaBadge();
    const ch = supabase
      .channel("admin-nav-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        cargarPedidosBadge();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cola_reproduccion" }, () => {
        cargarColaBadge();
      })
      .subscribe();
    const id = window.setInterval(refreshBadges, 45000);
    return () => {
      window.clearTimeout(badgeTimer);
      supabase.removeChannel(ch);
      window.clearInterval(id);
    };
  }, [esAdmin, accessToken, cargarPedidosBadge, cargarColaBadge]);

  useEffect(() => {
    if (user) setLogueando(false);
  }, [user]);

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

  const badgeTexto = (n: number) => (n > 9 ? "9+" : String(n));

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
          <BrandLogo size="nav" className="admin-nav-logo" />
          <div className="admin-user-mini">
            <span className="admin-sidebar-titulo">Panel</span>
            <span className="admin-user-email" title={perfil?.nombre ?? user.email ?? ""}>
              {perfil?.nombre ?? user.email}
            </span>
          </div>
        </div>
        <nav className="admin-sidebar-nav">
          {NAV.map(({ id, label, icon: Icon }) => {
            let badge = 0;
            if (id === "pedidos") badge = pedidosActivos;
            else if (id === "cola") badge = colaActiva;
            return (
              <button
                key={id}
                type="button"
                className={tab === id ? "active" : ""}
                onClick={() => irA(id)}
              >
                <span className="admin-nav-icon-wrap">
                  <Icon size={20} />
                  {badge > 0 && (
                    <span className="nav-badge" aria-label={`${badge} pendientes`}>
                      {badgeTexto(badge)}
                    </span>
                  )}
                </span>
                <span className="admin-nav-label">{label}</span>
                {id === "reproductor" && (
                  <SoundWaveSilhouette
                    className={`nav-sound-wave${musicaSonando ? " is-playing" : ""}`}
                  />
                )}
              </button>
            );
          })}
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
          {tab === "pedidos" && (
            <PedidosPanel
              accessToken={accessToken}
              onActiveCountChange={setPedidosActivos}
            />
          )}
          {tab === "carta" && <CartaPanel accessToken={accessToken} />}
          {tab === "cola" && (
            <ColaPanel
              accessToken={accessToken}
              onCountChange={setColaActiva}
            />
          )}
          {tab === "qrs" && <QRsPanel accessToken={accessToken} />}
          <div
            className={tab === "reproductor" ? "" : "repro-persist--hidden"}
            aria-hidden={tab !== "reproductor"}
          >
            <Reproductor
              accessToken={accessToken}
              visible={tab === "reproductor"}
              onPlayingChange={setMusicaSonando}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
