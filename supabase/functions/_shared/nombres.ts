/** Normaliza nombre para coincidencias (invitado o Google). */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "jhon" ≈ "jhon espinoza" ≈ "jhon espinoza mendoza"
 * Misma raíz de nombre de pila + uno contiene al otro.
 */
export function nombresSimilares(aRaw: string, bRaw: string): boolean {
  const a = normalizarNombre(aRaw);
  const b = normalizarNombre(bRaw);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(`${b} `) || b.startsWith(`${a} `)) return true;
  const ta = a.split(" ")[0] ?? "";
  const tb = b.split(" ")[0] ?? "";
  if (ta.length >= 3 && ta === tb && (a.includes(b) || b.includes(a))) return true;
  return false;
}

/** Union-Find para agrupar la misma persona por user_id o nombre parecido. */
export class AgrupadorPersonas {
  private parent = new Map<string, string>();
  private readonly nameKeys: string[] = [];

  private add(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  private find(id: string): string {
    this.add(id);
    let cur = id;
    while (this.parent.get(cur) !== cur) {
      const p = this.parent.get(cur)!;
      const gp = this.parent.get(p)!;
      this.parent.set(cur, gp);
      cur = p;
    }
    return cur;
  }

  private union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  registrar(nombreNorm: string, userId: string | null | undefined): string {
    const nk = `n:${nombreNorm}`;
    this.add(nk);
    if (!this.nameKeys.includes(nk)) {
      for (const existing of this.nameKeys) {
        if (nombresSimilares(existing.slice(2), nombreNorm)) this.union(existing, nk);
      }
      this.nameKeys.push(nk);
    }
    if (userId) {
      const uk = `u:${userId}`;
      this.add(uk);
      this.union(uk, nk);
    }
    return this.find(nk);
  }

  claveDe(nombreNorm: string, userId: string | null | undefined): string {
    return this.registrar(nombreNorm, userId);
  }
}
