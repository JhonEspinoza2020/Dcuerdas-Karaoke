const PALABRAS_BLOQUEADAS = new Set([
  "puto", "puta", "mierda", "pendejo", "pendeja", "culero", "culera",
  "idiota", "estupido", "estupida", "imbecil", "maricon", "marica",
  "hijueputa", "gonorrea", "malparido", "malparida", "hp", "ctm",
  "concha", "coño", "carajo", "verga", "pene", "vagina", "sexo",
  "pornografia", "porno", "nazi", "hitler",
]);

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

export function filtrarTexto(texto: string, campo: string): string {
  const limpio = texto.trim();
  if (contieneContenidoOfensivo(limpio)) {
    throw new Error(`contenido_no_permitido:${campo}`);
  }
  return limpio;
}
