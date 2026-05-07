import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "session";

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
 * Sessão pode ser de admin (login com senha) ou de coordenador
 * (login só pelo nome, igual ao formelider antigo).
 */
export type AdminSession = { type: "admin" };
export type CoordSession = { type: "coord"; contactId: string; slug: string; name: string };
export type SessionPayload = AdminSession | CoordSession;

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
