import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initSentry, Sentry } from "./sentry";
import { MesaPage } from "./cliente/pages/MesaPage";
import { AdminApp } from "./admin/AdminApp";
import { Landing } from "./Landing";
import "./index.css";

initSentry();

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: 24, fontFamily: "system-ui", textAlign: "center" }}>
          <p>Algo salió mal. Recarga la página.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      }
    >
      <BrowserRouter>
        <SentryRoutes>
          <Route path="/" element={<Landing />} />
          <Route path="/mesa/:numero" element={<MesaPage />} />
          <Route path="/admin" element={<AdminApp />} />
          <Route path="*" element={<Landing />} />
        </SentryRoutes>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
