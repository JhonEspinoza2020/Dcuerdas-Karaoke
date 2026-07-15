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
    total_mesas: 12,
  };
}
