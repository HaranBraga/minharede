import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession, verifySession } from "@/lib/auth-edge";

export { SESSION_COOKIE, signSession, verifySession };

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
  /** Nível do contato vinculado (0 = topo, maior = mais baixo) */
  roleLevel: number | null;
  /** Slug do contato (pra montar link público da rede) */
  contactSlug: string | null;
};

/** Lê cookie e retorna user atual (ou null). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true, name: true, username: true, isAdmin: true, active: true,
      contactId: true,
      contact: {
        select: {
          id: true, publicSlug: true,
          role: { select: { level: true } },
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
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/");
  return u;
}
