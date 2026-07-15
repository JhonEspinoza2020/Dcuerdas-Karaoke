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

function elegirVoz(): SpeechSynthesisVoice | null {
  const lista = window.speechSynthesis.getVoices();
  const es = lista.filter((v) => v.lang.toLowerCase().startsWith("es"));
  const score = (v: SpeechSynthesisVoice) => {
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
  };
  return [...es].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Solo el texto del cliente, en trozos cortos para variar el tono. */
function partirTextoCliente(texto: string): string[] {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const partes = limpio
    .split(/(?<=[.!?…,;:])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => {
      if (p.length <= 48) return [p];
      return p.split(/\s+(?=y\s|que\s|para\s|con\s)/i).map((x) => x.trim()).filter(Boolean);
    });
  return partes.length > 0 ? partes : [limpio];
}

function armarTrozos(textoOriginal: string): Trozo[] {
  const frases = partirTextoCliente(textoOriginal);
  const n = frases.length;
  return frases.map((frase, i) => {
    const t = i / Math.max(1, n - 1);
    // Voz más alegre: tono alto y ritmo vivo (sin inventar palabras).
    return {
      texto: frase,
      rate: 1.05 + t * 0.06,
      pitch: 1.22 - t * 0.06,
      pausaDespues: i < n - 1 ? 110 : 40,
    };
  });
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
  window.speechSynthesis.cancel();

  const guion = armarTrozos(limpio);

  const crearUtterance = (trozo: Trozo) => {
    const voz = elegirVoz();
    const u = new SpeechSynthesisUtterance(trozo.texto);
    u.lang = voz?.lang || "es-MX";
    if (voz) u.voice = voz;
    u.rate = Math.min(1.2, Math.max(0.9, trozo.rate));
    u.pitch = Math.min(1.45, Math.max(1.05, trozo.pitch));
    u.volume = 1;
    return u;
  };

  const terminar = () => {
    if (keepAlive) window.clearInterval(keepAlive);
    if (!cancelado) opts?.onEnd?.();
  };

  const hablarSiguiente = (i: number) => {
    if (cancelado) return;
    if (i >= guion.length) {
      terminar();
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
      pausaTimer = window.setTimeout(
        () => hablarSiguiente(i + 1),
        trozo.pausaDespues,
      );
    };
    u.onerror = () => terminar();
    window.speechSynthesis.speak(u);
  };

  const iniciar = () => {
    if (cancelado) return;
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
