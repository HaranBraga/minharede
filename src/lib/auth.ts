import { cookies } from "next/headers";
import { SESSION_COOKIE, signSession, verifySession, type SessionPayload } from "@/lib/auth-edge";

export { SESSION_COOKIE, signSession, verifySession };
export type { SessionPayload };

/** Lê o cookie de sessão (server-side) e retorna o payload, ou null. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function isAdmin(): Promise<boolean> {
  const s = await getSession();
  return s?.type === "admin";
}
