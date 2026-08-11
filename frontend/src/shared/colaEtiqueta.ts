/** Etiqueta visible en cola/TV: Local del dueño vs Mesa N. */
export function zonaCola(item: {
  tipo?: string | null;
  etiqueta?: string | null;
  numero_mesa?: number | null;
  nombre_cliente?: string | null;
}): string {
  if (item.tipo === "local" || item.etiqueta === "Local") return "Local";
  if (item.nombre_cliente === "Local" && (item.numero_mesa === 0 || item.numero_mesa == null)) {
    return "Local";
  }
  if (item.etiqueta?.trim()) return item.etiqueta.trim();
  if (item.numero_mesa != null && item.numero_mesa > 0) return `Mesa ${item.numero_mesa}`;
  return "Local";
}

/** Meta corta: "Local" o "Lucas · Mesa 6" (sin duplicar Local · Local). */
export function metaCola(item: {
  tipo?: string | null;
  etiqueta?: string | null;
  numero_mesa?: number | null;
  nombre_cliente?: string | null;
}): string {
  const zona = zonaCola(item);
  const nombre = item.nombre_cliente?.trim() || "";
  if (!nombre || nombre === zona || (nombre === "Local" && zona === "Local")) return zona;
  return `${nombre} · ${zona}`;
}
