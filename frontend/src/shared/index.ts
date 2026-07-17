export { dcuerdasTheme } from "./theme/dcuerdas";
export { marcaAssets } from "./assets";
export { es } from "./i18n/es";
export { supabase } from "./supabase/client";
export { useAuth } from "./auth/useAuth";
export type { Perfil } from "./supabase/client";
export { api } from "./api/karaoke";
export { adminApi, registrarVisita } from "./api/admin";
export { obtenerCarta } from "./api/carta";
export { speechRecognitionSupported, startVoiceSearch } from "./voiceSearch";
export {
  LIMITES,
  COOLDOWNS,
  sanitizarInput,
  validarNombre,
  validarSaludo,
  validarBusqueda,
  contieneContenidoOfensivo,
  msRestantesRateLimit,
  marcarRateLimit,
  formatearEspera,
} from "./clientValidation";
export type {
  ColaItem,
  LimiteCola,
  VideoResult,
  KaraokeEstado,
  TipoZona,
  MesaInfo,
  PedidoMesa,
  PedidoMesaItem,
} from "./api/karaoke";
export type {
  AdminResumen,
  AdminStats,
  ClienteFrecuente,
  LlegadaHoy,
  PedidoAdmin,
  PedidoItem,
  PedidosFiltro,
  PedidosQuery,
  PlatoAdmin,
  CategoriaAdmin,
} from "./api/admin";
export type { CategoriaCarta, Plato } from "./api/carta";
