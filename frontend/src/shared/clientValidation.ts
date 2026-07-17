/** Validación y rate-limit del lado cliente (espejo suave del backend). */

const PALABRAS_BLOQUEADAS = new Set([
  "puto", "puta", "mierda", "pendejo", "pendeja", "culero", "culera",
  "idiota", "estupido", "estupida", "imbecil", "maricon", "marica",
  "hijueputa", "gonorrea", "malparido", "malparida", "hp", "ctm",
  "concha", "coño", "carajo", "verga", "pene", "vagina", "sexo",
  "pornografia", "porno", "nazi", "hitler",
]);

export const LIMITES = {
  nombre: { min: 2, max: 80 },
  saludo: { max: 140 },
  busqueda: { max: 80 },
  nota: { max: 180 },
  telefono: { max: 20 },
} as const;

/** Cooldowns en ms (alineados con el backend cuando aplica). */
export const COOLDOWNS = {
  pedidoMs: 10_000,
  encolarMs: 3_000,
  saludoMs: 180_000,
  registroMs: 1_500,
  busquedaMs: 2_500,
  consultarLimiteMs: 4_000,
  pedidosMesaMs: 8_000,
} as const;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e")
    .replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t")
    .replace(/@/g, "a").replace(/\$/g, "s")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function contieneContenidoOfensivo(texto: string): boolean {
  const tokens = normalizar(texto).match(/[a-zñ]+/g) ?? [];
  for (const token of tokens) {
    if (PALABRAS_BLOQUEADAS.has(token)) return true;
    for (const palabra of PALABRAS_BLOQUEADAS) {
      if (palabra.length >= 4 && token.includes(palabra)) return true;
    }
  }
  return false;
}

function colapsarEspacios(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/** Quita caracteres de control y limita longitud mientras escribe. */
export function sanitizarInput(texto: string, max: number): string {
  return texto.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

export function validarNombre(raw: string): { ok: true; valor: string } | { ok: false; error: string } {
  const valor = colapsarEspacios(sanitizarInput(raw, LIMITES.nombre.max));
  if (valor.length < LIMITES.nombre.min) {
    return { ok: false, error: "Escribe tu nombre (mínimo 2 letras)." };
  }
  if (!/^[\p{L}\p{M}\d .'’-]+$/u.test(valor)) {
    return { ok: false, error: "El nombre solo puede tener letras, números y espacios." };
  }
  if (contieneContenidoOfensivo(valor)) {
    return { ok: false, error: "Tu mensaje contiene palabras no permitidas." };
  }
  return { ok: true, valor };
}

export function validarSaludo(raw: string): { ok: true; valor: string | null } | { ok: false; error: string } {
  const valor = colapsarEspacios(sanitizarInput(raw, LIMITES.saludo.max));
  if (!valor) return { ok: true, valor: null };
  if (valor.length > LIMITES.saludo.max) {
    return { ok: false, error: `El saludo puede tener hasta ${LIMITES.saludo.max} caracteres.` };
  }
  if (contieneContenidoOfensivo(valor)) {
    return { ok: false, error: "Tu saludo contiene palabras no permitidas." };
  }
  return { ok: true, valor };
}

export function validarBusqueda(raw: string): string {
  return sanitizarInput(raw, LIMITES.busqueda.max);
}

type RateBucket = { lastAt: number };

const memoria = new Map<string, RateBucket>();

function leerBucket(key: string): number {
  const mem = memoria.get(key)?.lastAt ?? 0;
  try {
    const raw = window.localStorage.getItem(`dc-rl-${key}`);
    const stored = raw ? Number(raw) : 0;
    return Math.max(mem, Number.isFinite(stored) ? stored : 0);
  } catch {
    return mem;
  }
}

function escribirBucket(key: string, at: number) {
  memoria.set(key, { lastAt: at });
  try {
    window.localStorage.setItem(`dc-rl-${key}`, String(at));
  } catch {
    /* ignore */
  }
}

/** Devuelve ms restantes de espera, o 0 si puede proceder. */
export function msRestantesRateLimit(key: string, cooldownMs: number): number {
  const last = leerBucket(key);
  const restante = last + cooldownMs - Date.now();
  return restante > 0 ? restante : 0;
}

export function marcarRateLimit(key: string) {
  escribirBucket(key, Date.now());
}

export function formatearEspera(ms: number): string {
  const seg = Math.ceil(ms / 1000);
  if (seg >= 60) {
    const mins = Math.ceil(seg / 60);
    return `${mins} ${mins === 1 ? "minuto" : "minutos"}`;
  }
  return `${Math.max(seg, 1)} ${seg === 1 ? "segundo" : "segundos"}`;
}
