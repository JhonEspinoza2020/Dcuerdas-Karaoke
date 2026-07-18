const TIMEZONE = "America/Lima";
/** Apertura del local (jornada nocturna). */
const HORA_INICIO = "17:30";
/** Cierre karaoke; la jornada de visitas sigue hasta HORA_CORTE_JORNADA. */
const HORA_FIN = "02:00";

function parseMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Fecha/hora "de pared" en Lima (mismo truco que el resto del proyecto). */
function ahoraLima(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
}

function limaDesdeIso(iso: string): Date {
  return new Date(new Date(iso).toLocaleString("en-US", { timeZone: TIMEZONE }));
}

/**
 * Inicio de la jornada actual para "Hoy en el local".
 * Antes de las 17:30 (Lima) se considera la noche anterior
 * (p. ej. a la 1:00 am del sábado sigue siendo la jornada del viernes).
 */
export function inicioJornadaActualIso(): string {
  const lima = ahoraLima();
  const mins = lima.getHours() * 60 + lima.getMinutes();
  if (mins < parseMinutos(HORA_INICIO)) {
    lima.setDate(lima.getDate() - 1);
  }
  const [h, m] = HORA_INICIO.split(":").map(Number);
  lima.setHours(h, m, 0, 0);
  return lima.toISOString();
}

/** Identificador de noche (YYYY-MM-DD del día en que abrió la jornada). */
export function claveJornadaDesdeIso(iso: string): string {
  const lima = limaDesdeIso(iso);
  const mins = lima.getHours() * 60 + lima.getMinutes();
  if (mins < parseMinutos(HORA_INICIO)) {
    lima.setDate(lima.getDate() - 1);
  }
  const y = lima.getFullYear();
  const mo = String(lima.getMonth() + 1).padStart(2, "0");
  const d = String(lima.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** Clave de la jornada actual (YYYY-MM-DD del día de apertura). */
export function claveJornadaActual(): string {
  return claveJornadaDesdeIso(new Date().toISOString());
}

/** UTC ISO cuyo reloj de pared en Lima es yy-mm-dd hh:mn. */
function limaWallToIso(yy: number, mm: number, dd: number, hh: number, mn: number): string {
  let guess = Date.UTC(yy, mm - 1, dd, hh, mn, 0);
  for (let i = 0; i < 3; i++) {
    const limaWall = new Date(new Date(guess).toLocaleString("en-US", { timeZone: TIMEZONE }));
    const want = Date.UTC(yy, mm - 1, dd, hh, mn, 0);
    const have = Date.UTC(
      limaWall.getFullYear(),
      limaWall.getMonth(),
      limaWall.getDate(),
      limaWall.getHours(),
      limaWall.getMinutes(),
      0,
    );
    guess += want - have;
  }
  return new Date(guess).toISOString();
}

/**
 * Rango ISO [inicio, fin) de una jornada por su clave YYYY-MM-DD (día de apertura en Lima).
 * Ej: 2026-07-17 → 17:30 del 17 hasta 17:30 del 18 (Lima).
 */
export function rangoJornadaPorClave(clave: string): { inicioIso: string; finIso: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clave.trim());
  if (!m) throw new Error("fecha_invalida");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const [h, mi] = HORA_INICIO.split(":").map(Number);
  const inicio = new Date(y, mo - 1, d);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return {
    inicioIso: limaWallToIso(y, mo, d, h, mi),
    finIso: limaWallToIso(fin.getFullYear(), fin.getMonth() + 1, fin.getDate(), h, mi),
  };
}

export function karaokeEstaAbierto(): boolean {
  if (Deno.env.get("KARAOKE_IGNORAR_HORARIO") === "true") return true;

  const ahora = new Date(
    new Date().toLocaleString("en-US", { timeZone: TIMEZONE }),
  );
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  const inicio = parseMinutos(HORA_INICIO);
  const fin = parseMinutos(HORA_FIN);

  if (inicio > fin) return minutos >= inicio || minutos < fin;
  return minutos >= inicio && minutos < fin;
}

export function validarHorario(): void {
  if (!karaokeEstaAbierto()) {
    throw new Error(`fuera_de_horario:${HORA_INICIO}:${HORA_FIN}`);
  }
}

export function estadoHorario() {
  return {
    abierto: karaokeEstaAbierto(),
    horario: { inicio: HORA_INICIO, fin: HORA_FIN, zona_horaria: TIMEZONE },
    limite_canciones_por_mesa: 5,
    ventana_canciones_minutos: 10,
    total_mesas: 12,
  };
}
