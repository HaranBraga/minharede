import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Login com username + senha (RedeUser).
 * Body: { username, password }
 */
export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: "Usuário e senha obrigatórios" }, { status: 400 });
  }
  const uname = String(username).toLowerCase().trim();

  const ip = getClientIp(req);
  const rl = checkRateLimit(`login:${ip}:${uname}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Tente em alguns minutos." }, { status: 429 });
  }

  const ru = await prisma.redeUser.findUnique({
    where: { username: uname },
    include: { contact: { include: { role: true } } },
  });
  if (!ru || !ru.active) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, ru.password);
  if (!ok) {
    return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  }

  await prisma.redeUser.update({ where: { id: ru.id }, data: { lastLogin: new Date() } });

  const token = await signSession({
    type: "member",
    contactId: ru.contact.id,
    slug: ru.contact.publicSlug ?? ru.contact.name,
    name: ru.contact.name,
    roleLevel: ru.contact.role.level,
  });
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
