/**
 * Lee el saludo en voz alta con pausas y ritmo más humano.
 * Web Speech no tiene emoción real; compensamos con velocidad baja,
 * tono cálido y frases cortas con silencios.
 */
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
  window.speechSynthesis.cancel();

  const elegirVoz = (lista: SpeechSynthesisVoice[]) => {
    const es = lista.filter((v) => v.lang.toLowerCase().startsWith("es"));
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      const n = `${v.name} ${v.lang}`.toLowerCase();
      if (/neural|natural|online|premium|enhanced/.test(n)) s += 8;
      if (/google/.test(n)) s += 5;
      if (/microsoft|sabina|paulina|elvira|dalia|mia|paloma|lucia/.test(n)) s += 4;
      if (/female|mujer|zira|helena|maria/.test(n)) s += 3;
      if (/es-pe|es-mx|es-us|es-ar|es-co/.test(n)) s += 3;
      if (/es-es/.test(n)) s += 1;
      if (/desktop|compact/.test(n)) s -= 2;
      return s;
    };
    return [...es].sort((a, b) => score(b) - score(a))[0] ?? null;
  };

  const frases = limpio
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const trozos = frases.length > 0 ? frases : [limpio];

  const crearUtterance = (frase: string, esPrimera: boolean, esUltima: boolean) => {
    const voz = elegirVoz(window.speechSynthesis.getVoices());
    const u = new SpeechSynthesisUtterance(frase);
    u.lang = voz?.lang || "es-MX";
    if (voz) u.voice = voz;
    u.rate = 0.88;
    u.pitch = esPrimera ? 1.1 : esUltima ? 1.04 : 1.06;
    u.volume = 1;
    return u;
  };

  const terminar = () => {
    if (keepAlive) window.clearInterval(keepAlive);
    if (!cancelado) opts?.onEnd?.();
  };

  const hablarSiguiente = (i: number) => {
    if (cancelado) return;
    if (i >= trozos.length) {
      terminar();
      return;
    }
    if (i === 0) opts?.onStart?.();

    const u = crearUtterance(trozos[i], i === 0, i === trozos.length - 1);
    u.onend = () => {
      if (cancelado) return;
      pausaTimer = window.setTimeout(
        () => hablarSiguiente(i + 1),
        i < trozos.length - 1 ? 80 : 20,
      );
    };
    u.onerror = () => terminar();
    window.speechSynthesis.speak(u);
  };

  const iniciar = () => {
    if (cancelado) return;
    keepAlive = window.setInterval(() => {
      if (cancelado) return;
      if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
    }, 3500);
    hablarSiguiente(0);
  };

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => iniciar();
    window.setTimeout(iniciar, 300);
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
