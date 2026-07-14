/** Éxitos del local — se eligen sin llamar a YouTube (0 cuota). */
export type ExitoLocal = {
  video_id: string;
  titulo: string;
  miniatura_url: string;
  canal: string | null;
};

function thumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}

export const EXITOS_LOCAL: ExitoLocal[] = [
  { video_id: "kJQP7kiw5Fk", titulo: "Luis Fonsi - Despacito", canal: "Luis Fonsi", miniatura_url: thumb("kJQP7kiw5Fk") },
  { video_id: "nfs8NYg7yQM", titulo: "Daddy Yankee - Gasolina", canal: "Daddy Yankee", miniatura_url: thumb("nfs8NYg7yQM") },
  { video_id: "qLbh-LXGFas", titulo: "Manuel Turizo - La Bachata", canal: "Manuel Turizo", miniatura_url: thumb("qLbh-LXGFas") },
  { video_id: "iOe6dI2JHgU", titulo: "Romeo Santos - Propuesta Indecente", canal: "Romeo Santos", miniatura_url: thumb("iOe6dI2JHgU") },
  { video_id: "hF-Zos_71aY", titulo: "Marc Anthony - Vivir Mi Vida", canal: "Marc Anthony", miniatura_url: thumb("hF-Zos_71aY") },
  { video_id: "TmKh7lAwnBI", titulo: "Maluma - Felices los 4", canal: "Maluma", miniatura_url: thumb("TmKh7lAwnBI") },
  { video_id: "7zp1TbLFPp8", titulo: "J Balvin - Mi Gente", canal: "J Balvin", miniatura_url: thumb("7zp1TbLFPp8") },
  { video_id: "pRpeEdMmmQ0", titulo: "Shakira - Waka Waka", canal: "Shakira", miniatura_url: thumb("pRpeEdMmmQ0") },
  { video_id: "2Vv-BfVoq4g", titulo: "Ed Sheeran - Perfect", canal: "Ed Sheeran", miniatura_url: thumb("2Vv-BfVoq4g") },
  { video_id: "fJ9rUzIMcZQ", titulo: "Queen - Bohemian Rhapsody", canal: "Queen", miniatura_url: thumb("fJ9rUzIMcZQ") },
  { video_id: "PT2_F-1esPk", titulo: "The Weeknd - Blinding Lights", canal: "The Weeknd", miniatura_url: thumb("PT2_F-1esPk") },
  { video_id: "OPf0YbXqDm0", titulo: "Bruno Mars - Uptown Funk", canal: "Bruno Mars", miniatura_url: thumb("OPf0YbXqDm0") },
];
