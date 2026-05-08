import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "@/lib/auth-edge";

export { SESSION_COOKIE, signSession, verifySession };
export type { SessionPayload };

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function isAdmin(): Promise<boolean> {
  const s = await getSession();
  return s?.type === "admin";
}

/** Retorna IDs de Contact que estão na rede gerenciável do session. Admin vê tudo. */
export async function descendantContactIds(s: SessionPayload | null): Promise<string[] | "all"> {
  if (!s) return [];
  if (s.type === "admin") return "all";

  const ids = new Set<string>([s.contactId]);
  let frontier: string[] = [s.contactId];
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

export async function canManageContact(s: SessionPayload | null, targetId: string): Promise<boolean> {
  const ids = await descendantContactIds(s);
  if (ids === "all") return true;
  return ids.includes(targetId);
}

/** Levels que o session pode criar. Admin: todos. Member: só níveis abaixo do dele. */
export function rolesAllowedToCreate(s: SessionPayload | null): { minLevel: number } {
  if (!s) return { minLevel: 99 };
  if (s.type === "admin") return { minLevel: 0 };
  return { minLevel: s.roleLevel + 1 };
}
