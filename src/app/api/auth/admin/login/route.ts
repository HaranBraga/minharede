import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Login admin do minha-rede. Tenta primeiro a tabela RedeAdminUser
 * (usuários individuais). Se não bater, cai no fallback ADMIN_PASSWORD
 * (master, sempre super-admin).
 *
 * Body: { username?, password }
 *  - Se vier só password, tenta master (ADMIN_PASSWORD).
 *  - Se vier username+password, tenta AdminUser; se não bater,
 *    tenta master como último recurso.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password: string | undefined = body.password;
  const username: string | undefined = body.username?.toString().trim().toLowerCase();
  if (!password) return NextResponse.json({ error: "Senha obrigatória" }, { status: 400 });

  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-login:${ip}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  // 1) Tenta usuário individual
  if (username) {
    const user = await prisma.redeAdminUser.findUnique({ where: { username } });
    if (user && user.active && await bcrypt.compare(password, user.password)) {
      await prisma.redeAdminUser.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
      const token = await signSession({
        type: "admin",
        adminUserId: user.id,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin,
      });
      const res = NextResponse.json({ ok: true, name: user.name });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
  }

  // 2) Fallback: ADMIN_PASSWORD master (super-admin implícito)
  const expected = process.env.ADMIN_PASSWORD;
  if (expected && password === expected) {
    const token = await signSession({
      type: "admin",
      name: "Master",
      isSuperAdmin: true,
    });
    const res = NextResponse.json({ ok: true, name: "Master" });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
}
