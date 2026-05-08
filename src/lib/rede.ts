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

import { slugify } from "@/lib/slug";

/**
 * Gera username único pra RedeUser baseado no nome. Adiciona sufixo numérico
 * em caso de colisão. Usado quando criamos coord/líder via dashboard e
 * geramos login automático.
 */
export async function uniqueUsername(name: string): Promise<string> {
  const base = slugify(name).replace(/[^a-z0-9]+/g, "") || "user";
  let candidate = base;
  let n = 1;
  while (await prisma.redeUser.findUnique({ where: { username: candidate } })) {
    n += 1;
    candidate = `${base}${n}`;
    if (n > 999) return `${base}-${Date.now()}`;
  }
  return candidate;
}

/** Default password (bcrypt-hashable). User troca depois nas configs. */
export const DEFAULT_USER_PASSWORD = "123456";

/** Normaliza um telefone pra o formato 55+DDD+número. Retorna null se inválido. */
export function normalizePhone(input: string): string | null {
  const d = String(input ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.startsWith("55") ? d : `55${d}`;
}

/**
 * Constrói o payload de campos pessoais do Contact a partir do body.
 * Aceita: email, dataNascimento (ISO ou DD/MM/AAAA), genero, rua, bairro,
 * cidade, zona.
 */
export function buildPersonalFields(body: any): {
  email: string | null;
  dataNascimento: Date | null;
  genero: string | null;
  rua: string | null;
  bairro: string | null;
  cidade: string | null;
  zona: string | null;
} {
  let nascimento: Date | null = null;
  if (body.dataNascimento) {
    const s = String(body.dataNascimento).trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) nascimento = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
    else {
      const d = new Date(s);
      if (!isNaN(d.getTime())) nascimento = d;
    }
  }
  return {
    email:          body.email?.trim() || null,
    dataNascimento: nascimento,
    genero:         body.genero?.trim() || null,
    rua:            body.rua?.trim() || null,
    bairro:         body.bairro?.trim() || null,
    cidade:         body.cidade?.trim() || null,
    zona:           body.zona?.trim() || null,
  };
}
