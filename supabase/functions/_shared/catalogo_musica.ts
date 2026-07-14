import type { VideoCacheItem } from "./youtube_cache.ts";

/** Éxitos del local: responden sin gastar cuota de YouTube. */
type EntradaCatalogo = VideoCacheItem & { claves: string[] };

function thumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

const CATALOGO: EntradaCatalogo[] = [
  { video_id: "kJQP7kiw5Fk", titulo: "Luis Fonsi - Despacito ft. Daddy Yankee", canal: "Luis Fonsi", miniatura_url: thumb("kJQP7kiw5Fk"), claves: ["despacito", "fonsi", "daddy yankee"] },
  { video_id: "pRpeEdMmmQ0", titulo: "Shakira - Waka Waka (This Time for Africa)", canal: "Shakira", miniatura_url: thumb("pRpeEdMmmQ0"), claves: ["waka waka", "shakira", "africa"] },
  { video_id: "7zp1TbLFPp8", titulo: "J Balvin, Willy William - Mi Gente", canal: "J Balvin", miniatura_url: thumb("7zp1TbLFPp8"), claves: ["mi gente", "j balvin", "willy"] },
  { video_id: "OPf0YbXqDm0", titulo: "Mark Ronson - Uptown Funk ft. Bruno Mars", canal: "Mark Ronson", miniatura_url: thumb("OPf0YbXqDm0"), claves: ["uptown funk", "bruno mars", "ronson"] },
  { video_id: "CevxZvSJLk8", titulo: "Katy Perry - Roar", canal: "Katy Perry", miniatura_url: thumb("CevxZvSJLk8"), claves: ["roar", "katy perry"] },
  { video_id: "fJ9rUzIMcZQ", titulo: "Queen - Bohemian Rhapsody", canal: "Queen Official", miniatura_url: thumb("fJ9rUzIMcZQ"), claves: ["bohemian", "rhapsody", "queen"] },
  { video_id: "hT_nvWreIhg", titulo: "OneRepublic - Counting Stars", canal: "OneRepublic", miniatura_url: thumb("hT_nvWreIhg"), claves: ["counting stars", "onerepublic"] },
  { video_id: "2Vv-BfVoq4g", titulo: "Ed Sheeran - Perfect", canal: "Ed Sheeran", miniatura_url: thumb("2Vv-BfVoq4g"), claves: ["perfect", "ed sheeran", "sheeran"] },
  { video_id: "YQHsXMglC9A", titulo: "Adele - Hello", canal: "Adele", miniatura_url: thumb("YQHsXMglC9A"), claves: ["hello", "adele"] },
  { video_id: "09R8_2nJtjg", titulo: "Maroon 5 - Sugar", canal: "Maroon 5", miniatura_url: thumb("09R8_2nJtjg"), claves: ["sugar", "maroon 5", "maroon"] },
  { video_id: "PT2_F-1esPk", titulo: "The Weeknd - Blinding Lights", canal: "The Weeknd", miniatura_url: thumb("PT2_F-1esPk"), claves: ["blinding lights", "weeknd", "the weeknd"] },
  { video_id: "RgKAFK5djSk", titulo: "Wiz Khalifa - See You Again ft. Charlie Puth", canal: "Wiz Khalifa", miniatura_url: thumb("RgKAFK5djSk"), claves: ["see you again", "charlie puth", "fast furious"] },
  { video_id: "lp-EO5I60KA", titulo: "Eminem - Lose Yourself", canal: "EminemMusic", miniatura_url: thumb("lp-EO5I60KA"), claves: ["lose yourself", "eminem"] },
  { video_id: "e-ORhEE9VVg", titulo: "Taylor Swift - Blank Space", canal: "Taylor Swift", miniatura_url: thumb("e-ORhEE9VVg"), claves: ["blank space", "taylor swift", "taylor"] },
  { video_id: "uelHwf8o7_U", titulo: "Eminem - Love The Way You Lie ft. Rihanna", canal: "EminemMusic", miniatura_url: thumb("uelHwf8o7_U"), claves: ["love the way you lie", "rihanna", "eminem"] },
  { video_id: "3AtDnEC4zak", titulo: "Charlie Puth - Attention", canal: "Charlie Puth", miniatura_url: thumb("3AtDnEC4zak"), claves: ["attention", "charlie puth"] },
  { video_id: "fRh_vgS2dFE", titulo: "Justin Bieber - Sorry", canal: "Justin Bieber", miniatura_url: thumb("fRh_vgS2dFE"), claves: ["sorry", "justin bieber", "bieber"] },
  { video_id: "0KSOMA3QBU0", titulo: "Katy Perry - Dark Horse", canal: "Katy Perry", miniatura_url: thumb("0KSOMA3QBU0"), claves: ["dark horse", "katy perry"] },
  { video_id: "9bZkp7q19f0", titulo: "PSY - GANGNAM STYLE", canal: "officialpsy", miniatura_url: thumb("9bZkp7q19f0"), claves: ["gangnam", "psy", "gangnam style"] },
  { video_id: "OPf0YbXqDm0", titulo: "Bruno Mars - Uptown Funk", canal: "Bruno Mars", miniatura_url: thumb("OPf0YbXqDm0"), claves: ["bruno", "funk"] },
  { video_id: "nfs8NYg7yQM", titulo: "Daddy Yankee - Gasolina", canal: "Daddy Yankee", miniatura_url: thumb("nfs8NYg7yQM"), claves: ["gasolina", "daddy yankee", "reggaeton"] },
  { video_id: "bNvM6BPECdE", titulo: "Carlos Vives, Shakira - La Bicicleta", canal: "Carlos Vives", miniatura_url: thumb("bNvM6BPECdE"), claves: ["bicicleta", "carlos vives", "shakira"] },
  { video_id: "qLbh-LXGFas", titulo: "Manuel Turizo - La Bachata", canal: "Manuel Turizo", miniatura_url: thumb("qLbh-LXGFas"), claves: ["bachata", "manuel turizo", "la bachata"] },
  { video_id: "saGYMhApPOs", titulo: "Bad Bunny - Tití Me Preguntó", canal: "Bad Bunny", miniatura_url: thumb("saGYMhApPOs"), claves: ["titi", "tití", "bad bunny", "preguntó", "pregunto"] },
  { video_id: "saStndAgvVg", titulo: "Bad Bunny - Moscow Mule", canal: "Bad Bunny", miniatura_url: thumb("saStndAgvVg"), claves: ["moscow mule", "bad bunny"] },
  { video_id: "TmKh7lAwnBI", titulo: "Maluma - Felices los 4", canal: "Maluma", miniatura_url: thumb("TmKh7lAwnBI"), claves: ["felices los 4", "maluma", "felices"] },
  { video_id: "jJPMnTXl63E", titulo: "Sebastián Yatra - Traicionera", canal: "SebastianYatraVEVO", miniatura_url: thumb("jJPMnTXl63E"), claves: ["traicionera", "yatra", "sebastian"] },
  { video_id: "uo2v69bQ_5A", titulo: "Ozuna - Se Preparó", canal: "Ozuna", miniatura_url: thumb("uo2v69bQ_5A"), claves: ["se preparo", "se preparó", "ozuna"] },
  { video_id: "iOe6dI2JHgU", titulo: "Romeo Santos - Propuesta Indecente", canal: "RomeoSantosVEVO", miniatura_url: thumb("iOe6dI2JHgU"), claves: ["propuesta indecente", "romeo santos", "romeo"] },
  { video_id: "GOzw_YKjW3A", titulo: "Grupo 5 - El Ritmo del Amor", canal: "Grupo 5", miniatura_url: thumb("GOzw_YKjW3A"), claves: ["grupo 5", "cumbia", "ritmo del amor"] },
  { video_id: "ZQ5_i77xG5E", titulo: "Armonía 10 - El Torito", canal: "Armonia 10", miniatura_url: thumb("ZQ5_i77xG5E"), claves: ["armonia 10", "armonía 10", "torito", "cumbia"] },
  { video_id: "dyRsYk0LyA8", titulo: "Los Ángeles Azules - Cómo Te Voy A Olvidar", canal: "Los Ángeles Azules", miniatura_url: thumb("dyRsYk0LyA8"), claves: ["como te voy a olvidar", "angeles azules", "cumbia"] },
  { video_id: "AtKZKl7Bgu0", titulo: "Grupo Niche - Una Aventura", canal: "Grupo Niche", miniatura_url: thumb("AtKZKl7Bgu0"), claves: ["una aventura", "niche", "salsa"] },
  { video_id: "hF-Zos_71aY", titulo: "Marc Anthony - Vivir Mi Vida", canal: "Marc Anthony", miniatura_url: thumb("hF-Zos_71aY"), claves: ["vivir mi vida", "marc anthony", "salsa"] },
  { video_id: "qdro2dY3UFM", titulo: "Gilberto Santa Rosa - Un Montón de Estrellas", canal: "Gilberto Santa Rosa", miniatura_url: thumb("qdro2dY3UFM"), claves: ["monton de estrellas", "montón de estrellas", "gilberto"] },
];

function aItem(e: EntradaCatalogo): VideoCacheItem {
  return {
    video_id: e.video_id,
    titulo: e.titulo,
    miniatura_url: e.miniatura_url,
    canal: e.canal,
  };
}

/** Coincide si el término está en título o claves (sin API). */
export function buscarEnCatalogo(termino: string, limite = 12): VideoCacheItem[] {
  const q = termino.trim().toLowerCase();
  if (q.length < 2) return [];

  const vistos = new Set<string>();
  const out: VideoCacheItem[] = [];

  for (const e of CATALOGO) {
    const hay =
      e.titulo.toLowerCase().includes(q) ||
      e.claves.some((c) => c.includes(q) || q.includes(c));
    if (!hay || vistos.has(e.video_id)) continue;
    vistos.add(e.video_id);
    out.push(aItem(e));
    if (out.length >= limite) break;
  }
  return out;
}

/** Sugerencias al abrir la búsqueda (0 cuota). */
export function exitosDestacados(limite = 12): VideoCacheItem[] {
  const vistos = new Set<string>();
  const out: VideoCacheItem[] = [];
  for (const e of CATALOGO) {
    if (vistos.has(e.video_id)) continue;
    vistos.add(e.video_id);
    out.push(aItem(e));
    if (out.length >= limite) break;
  }
  return out;
}
