/**
 * Gera um slug a partir de um nome — usado em Contact.publicSlug.
 * Mantém compat com os links já distribuídos do minha-rede atual
 * (que usam o nome cru no query string).
 *
 * Ex: "João Silva" → "joao-silva"
 *     "Mario"      → "mario"
 *     "Coord 01"   → "coord-01"
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // tira acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

import { prisma } from "@/lib/prisma";

/**
 * Gera um slug único pra um Contact, lidando com colisões adicionando
 * sufixo numérico (-2, -3, ...) até achar um livre.
 */
export async function uniqueSlug(name: string, excludeContactId?: string): Promise<string> {
  const base = slugify(name) || "contato";
  let candidate = base;
  let n = 1;
  while (true) {
    const existing = await prisma.contact.findUnique({ where: { publicSlug: candidate } });
    if (!existing || existing.id === excludeContactId) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
    if (n > 999) return `${base}-${Date.now()}`;
  }
}
