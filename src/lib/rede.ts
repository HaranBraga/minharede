import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";

/**
 * Helpers compartilhados entre os endpoints /api/leaders e /api/coordinators.
 * Mantêm o formato { id, name, link, coordinator } esperado pela UI do
 * formelider — internamente operam sobre Contact + PersonRole.
 */

const ROLE_COORD_KEY = "COORDENADOR";
const ROLE_LIDER_KEY = "LIDER";

let _coordRoleId: string | null = null;
let _liderRoleId: string | null = null;

export async function getCoordRoleId(): Promise<string> {
  if (_coordRoleId) return _coordRoleId;
  const r = await prisma.personRole.findFirst({
    where: { OR: [{ key: ROLE_COORD_KEY }, { id: "role-coordenador" }] },
    select: { id: true },
  });
  if (!r) throw new Error("Cargo COORDENADOR não cadastrado");
  _coordRoleId = r.id;
  return r.id;
}

export async function getLiderRoleId(): Promise<string> {
  if (_liderRoleId) return _liderRoleId;
  const r = await prisma.personRole.findFirst({
    where: { OR: [{ key: ROLE_LIDER_KEY }, { id: "role-lider" }] },
    select: { id: true },
  });
  if (!r) throw new Error("Cargo LIDER não cadastrado");
  _liderRoleId = r.id;
  return r.id;
}

/** Monta o link público a partir do slug e tipo. */
export function publicLink(base: string, kind: "lider" | "coord" | "coord_form", slug: string): string {
  const cleaned = base.replace(/\/+$/, "");
  return `${cleaned}/?${kind}=${encodeURIComponent(slug)}`;
}

/** Phone placeholder único pra Contact.phone (que é @unique). */
export function placeholderPhone(): string {
  return `placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Busca/cria slug único. Reutiliza o helper existente.
 */
export { uniqueSlug };
