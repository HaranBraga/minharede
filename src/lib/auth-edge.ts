import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "minha_rede_session";

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!raw || raw.length < 32)) {
    throw new Error(
      "AUTH_SECRET não configurada (ou muito curta). Em produção, defina " +
      "uma string aleatória de pelo menos 32 caracteres.",
    );
  }
  return new TextEncoder().encode(raw || "dev-secret-change-me-in-production");
}

/**
 * Sessão do minha-rede. Não usa a tabela User (que é compartilhada com
 * CRM/painel-360) — identidade é o próprio Contact.
 *
 * - admin:  autenticado com ADMIN_PASSWORD env, vê toda a rede.
 * - member: autenticado pelo nome do contato (sem senha, igual formelider
 *           antigo). Vê os descendentes do seu Contact.
 */
export type SessionPayload =
  | { type: "admin" }
  | { type: "member"; contactId: string; slug: string; name: string; roleLevel: number };

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
