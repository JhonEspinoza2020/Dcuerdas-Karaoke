/**
 * D'cuerdas Resto-Bar — Design Tokens
 */
export const dcuerdasTheme = {
  colors: {
    background: "#0a0a0a",
    surface: "#1a1a1a",
    surfaceElevated: "#252525",
    textPrimary: "#f5f0e8",
    textSecondary: "#a89f94",
    accent: "#e85d04",
    accentGold: "#f48c06",
    accentHover: "#dc2f02",
    success: "#2d6a4f",
    error: "#9d0208",
    border: "#333333",
  },
  fonts: {
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
  },
  branding: {
    nombre: "D'cuerdas",
    subtitulo: "Resto-Bar",
    lema: "Ama, Come Y Bebe Que La Vida Es Breve",
    tagline: "¡A cantar se ha dicho!",
    logo: "/logo-empresa.png",
  },
} as const;
