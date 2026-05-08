import { NextRequest, NextResponse } from "next/server";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logRedeLogin } from "@/lib/rede-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Login do admin do minha-rede. Senha em ADMIN_PASSWORD env. */
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  if (!password) return NextResponse.json({ error: "Senha obrigatória" }, { status: 400 });

  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-login:${ip}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return NextResponse.json({ error: "ADMIN_PASSWORD não configurada" }, { status: 500 });
  if (password !== expected) return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });

  await logRedeLogin({ type: "admin", actorName: "Admin", req });

  const token = await signSession({ type: "admin" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
