/**
 * Lee el saludo del cliente en voz alta.
 * No agrega texto: solo intenta que la voz suene más alegre
 * (tono, ritmo y trozos cortos del mensaje original).
 */

type Trozo = {
  texto: string;
  rate: number;
  pitch: number;
  pausaDespues: number;
};

function scoreVoz(v: SpeechSynthesisVoice): number {
  let s = 0;
  const n = `${v.name} ${v.lang}`.toLowerCase();
  if (/google español|google spanish/.test(n)) s += 12;
  if (/neural|natural|online|premium|enhanced|wavenet/.test(n)) s += 10;
  if (/google/.test(n)) s += 6;
  if (/microsoft.*(sabina|paulina|elvira|dalia|mia|paloma|lucia)/.test(n)) s += 7;
  if (/sabina|paulina|elvira|dalia|mia|paloma|lucia|maria|helena/.test(n)) s += 4;
  if (/es-mx|es-us|es-ar|es-co|es-pe|es-cl|es-419/.test(n)) s += 5;
  if (/es-es/.test(n)) s += 1;
  if (/desktop|compact|untitled/.test(n)) s -= 4;
  return s;
}

function elegirVoz(): SpeechSynthesisVoice | null {
  const es = window.speechSynthesis.getVoices().filter((v) =>
    v.lang.toLowerCase().startsWith("es"),
  );
  return [...es].sort((a, b) => scoreVoz(b) - scoreVoz(a))[0] ?? null;
}

/** Solo el texto del cliente, en trozos cortos para variar el tono. */
function partirPorPuntuacion(texto: string): string[] {
  const partes: string[] = [];
  let buf = "";
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    buf += ch;
    const siguienteEspacio = texto[i + 1] === " ";
    if (siguienteEspacio && ".!?…,;:".includes(ch)) {
      const t = buf.trim();
      if (t) partes.push(t);
      buf = "";
      i += 1;
    }
  }
  const resto = buf.trim();
  if (resto) partes.push(resto);
  return partes.length > 0 ? partes : [texto];
}

const CONECTORES = [" y ", " que ", " para ", " con "];

function partirPorConectores(frase: string): string[] {
  if (frase.length <= 48) return [frase];
  const lower = frase.toLowerCase();
  let best = -1;
  let bestLen = 0;
  for (const c of CONECTORES) {
    const idx = lower.indexOf(c);
    if (idx > 0 && (best < 0 || idx < best)) {
      best = idx;
      bestLen = c.length;
    }
  }
  if (best < 0) return [frase];
  const izq = frase.slice(0, best).trim();
  const der = frase.slice(best + bestLen).trim();
  return [...(izq ? [izq] : []), ...partirPorConectores(der)].filter(Boolean);
}

function partirTextoCliente(texto: string): string[] {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!limpio) return [];
  return partirPorPuntuacion(limpio).flatMap(partirPorConectores);
}

function armarTrozos(textoOriginal: string): Trozo[] {
  const frases = partirTextoCliente(textoOriginal);
  const n = frases.length;
  return frases.map((frase, i) => {
    const t = i / Math.max(1, n - 1);
    return {
      texto: frase,
      rate: 0.92 + t * 0.04,
      pitch: 1.12 - t * 0.04,
      pausaDespues: i < n - 1 ? 140 : 50,
    };
  });
}

const REPETICIONES_SALUDO = 1;
const PAUSA_ENTRE_REPETICIONES_MS = 650;

function expandirGuion(base: Trozo[]): Trozo[] {
  const guion: Trozo[] = [];
  for (let r = 0; r < REPETICIONES_SALUDO; r++) {
    for (let i = 0; i < base.length; i++) {
      const trozo = base[i];
      const esUltimo = i === base.length - 1;
      const hayOtra = r < REPETICIONES_SALUDO - 1;
      guion.push({
        ...trozo,
        pausaDespues: esUltimo && hayOtra ? PAUSA_ENTRE_REPETICIONES_MS : trozo.pausaDespues,
      });
    }
  }
  return guion;
}

function crearUtterance(trozo: Trozo): SpeechSynthesisUtterance {
  const voz = elegirVoz();
  const u = new SpeechSynthesisUtterance(trozo.texto);
  u.lang = voz?.lang || "es-MX";
  if (voz) u.voice = voz;
  u.rate = Math.min(1.05, Math.max(0.85, trozo.rate));
  u.pitch = Math.min(1.25, Math.max(1.0, trozo.pitch));
  u.volume = 1;
  return u;
}

export function leerSaludo(
  texto: string,
  opts?: { onEnd?: () => void; onStart?: () => void },
): () => void {
  const limpio = texto.trim();
  if (!limpio || typeof window === "undefined" || !window.speechSynthesis) {
    opts?.onEnd?.();
    return () => {};
  }

  let cancelado = false;
  let pausaTimer: number | undefined;
  let keepAlive: number | undefined;
  let started = false;
  let yaInicio = false;
  window.speechSynthesis.cancel();

  const guion = expandirGuion(armarTrozos(limpio));

  const terminar = () => {
    if (keepAlive) window.clearInterval(keepAlive);
    if (!cancelado) opts?.onEnd?.();
  };

  const hablarSiguiente = (i: number) => {
    if (cancelado || i >= guion.length) {
      if (!cancelado && i >= guion.length) terminar();
      return;
    }
    if (!started) {
      started = true;
      opts?.onStart?.();
    }
    const trozo = guion[i];
    const u = crearUtterance(trozo);
    u.onend = () => {
      if (cancelado) return;
      pausaTimer = window.setTimeout(() => hablarSiguiente(i + 1), trozo.pausaDespues);
    };
    u.onerror = () => terminar();
    window.speechSynthesis.speak(u);
  };

  const iniciar = () => {
    if (cancelado || yaInicio) return;
    yaInicio = true;
    keepAlive = window.setInterval(() => {
      if (cancelado) return;
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.resume();
      }
    }, 2500);
    hablarSiguiente(0);
  };

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => iniciar();
    window.setTimeout(iniciar, 280);
  } else {
    iniciar();
  }

  return () => {
    cancelado = true;
    if (pausaTimer) window.clearTimeout(pausaTimer);
    if (keepAlive) window.clearInterval(keepAlive);
    window.speechSynthesis.cancel();
  };
}
