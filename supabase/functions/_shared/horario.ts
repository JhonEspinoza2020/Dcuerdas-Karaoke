const TIMEZONE = "America/Lima";
const HORA_INICIO = "17:30";
const HORA_FIN = "02:00";

function parseMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
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
