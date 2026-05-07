import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "@/lib/auth-edge";

export { SESSION_COOKIE, signSession, verifySession };
export type { SessionPayload };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export type CurrentUser = {
  id: string;
  name: string;
  username: string | null;
  isAdmin: boolean;
  contactId: string | null;
  /** Level do role do contato vinculado (0=Coord Grupo, 1=Coord, 2=Líder, 3=Apoiador). */
  roleLevel: number | null;
  /** Slug do contato — usado pra montar links públicos. */
  contactSlug: string | null;
  /** Nome do contato vinculado (pra exibir no header). */
  contactName: string | null;
};

/** Lê cookie e busca user atualizado no banco. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true, name: true, username: true, isAdmin: true, active: true, contactId: true,
      contact: {
        select: {
          id: true, name: true, publicSlug: true,
          role: { select: { level: true, key: true } },
        },
      },
    },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    isAdmin: user.isAdmin,
    contactId: user.contactId,
    roleLevel: user.contact?.role?.level ?? null,
    contactSlug: user.contact?.publicSlug ?? null,
    contactName: user.contact?.name ?? null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  // "Admin" no minha-rede = User.isAdmin OU Coord Grupo (level 0)
  const isCoordGrupo = u.roleLevel === 0;
  if (!u.isAdmin && !isCoordGrupo) redirect("/dashboard");
  return u;
}

/**
 * Retorna IDs de Contact que estão na "rede" (subárvore descendente)
 * do user, incluindo ele mesmo. Admin e Coord Grupo vêem TUDO.
 *
 * Usado pra filtrar listagens (apenas mostrar líderes/apoiadores que
 * o user pode gerenciar).
 */
export async function descendantContactIds(user: CurrentUser): Promise<string[] | "all"> {
  // Admin e Coord de Grupo veem tudo
  if (user.isAdmin || user.roleLevel === 0) return "all";
  if (!user.contactId) return [];

  const ids = new Set<string>([user.contactId]);
  let frontier: string[] = [user.contactId];
  for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
    const children = await prisma.contact.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const next: string[] = [];
    for (const c of children) {
      if (!ids.has(c.id)) {
        ids.add(c.id);
        next.push(c.id);
      }
    }
    frontier = next;
  }
  return Array.from(ids);
}

/**
 * Verifica se um Contact está na rede gerenciável do user (descendente
 * direto ou recursivo). Usado pra autorizar update/delete em /api/leaders/:id.
 */
export async function canManageContact(user: CurrentUser, targetContactId: string): Promise<boolean> {
  const ids = await descendantContactIds(user);
  if (ids === "all") return true;
  return ids.includes(targetContactId);
}

/**
 * Cargos que o user pode CRIAR (níveis abaixo do dele).
 * Admin/Coord Grupo: todos abaixo dele.
 */
export function rolesAllowedToCreate(user: CurrentUser): { minLevel: number } {
  // Admin sem contato: pode criar a partir do Coord Grupo (level 0)
  if (user.isAdmin && user.roleLevel == null) return { minLevel: 0 };
  // Tem contato: só níveis ESTRITAMENTE maiores que o seu
  return { minLevel: (user.roleLevel ?? -1) + 1 };
}
