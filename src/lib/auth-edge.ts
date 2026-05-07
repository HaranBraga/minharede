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
 * Sessão padrão do ecossistema (mesma estrutura do conect-crm).
 * Quem identifica a posição na rede é o User.contactId.
 */
export type SessionPayload = {
  uid: string;
  isAdmin: boolean;
  contactId: string | null;
  /** Level do role do contato vinculado: 0=Coord Grupo, 1=Coord, 2=Líder, 3=Apoiador. */
  roleLevel: number | null;
};

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
