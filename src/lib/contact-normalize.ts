/**
 * Normaliza campos de Contact para UPPERCASE antes de gravar no banco.
 * Aplica em: name, rua, bairro, cidade, zona, genero.
 * Demais campos passam intactos.
 *
 * Uso:
 *   const data = normalizeContactInput(body);
 *   await prisma.contact.create({ data });
 */
export function upperOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.toUpperCase() : null;
}

const UPPER_FIELDS = ["name", "rua", "bairro", "cidade", "zona", "genero"] as const;

export function normalizeContactInput<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = { ...data };
  for (const k of UPPER_FIELDS) {
    if (k in out) {
      const v = out[k];
      // name é obrigatório — se vazio, mantém vazio (validação acontece no zod)
      if (k === "name") {
        out[k] = v === null || v === undefined ? v : String(v).trim().toUpperCase();
      } else {
        out[k] = upperOrNull(v);
      }
    }
  }
  return out as T;
}
