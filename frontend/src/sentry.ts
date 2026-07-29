import * as Sentry from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { useEffect } from "react";

/**
 * Solo arranca si hay DSN (Vercel / .env local).
 * Sin DSN la app funciona igual; no envía nada.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) return;

  const isProd = import.meta.env.PROD;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      // Solo graba replay cuando hay error (privacidad + costo).
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: isProd ? 0.15 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: isProd ? 1.0 : 0,
    // No mandar PII por defecto (mesas / nombres en URL).
    sendDefaultPii: false,
  });
}

export { Sentry };
