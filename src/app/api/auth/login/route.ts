import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession, SESSION_COOKIE } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json().catch(() => ({}));
    if (!username || !password) {
      return NextResponse.json({ error: "Usuário e senha obrigatórios" }, { status: 400 });
    }
    const uname = String(username).toLowerCase().trim();

    const ip = getClientIp(req);
    const rl = checkRateLimit(`login:${ip}:${uname}`, { limit: 8, windowMs: 15 * 60_000 });
    if (!rl.ok) {
      const min = Math.ceil(rl.retryAfterMs / 60_000);
      return NextResponse.json(
        { error: `Muitas tentativas. Tente novamente em ${min} min.` },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: uname },
      include: { contact: { include: { role: true } } },
    });
    if (!user || !user.active) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }
    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

    const token = await signSession({
      uid: user.id,
      isAdmin: user.isAdmin,
      contactId: user.contactId,
      roleLevel: user.contact?.role?.level ?? null,
    });
    const res = NextResponse.json({
      user: {
        id: user.id, name: user.name, username: user.username,
        isAdmin: user.isAdmin, contactId: user.contactId,
        roleLevel: user.contact?.role?.level ?? null,
        contactName: user.contact?.name ?? null,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err: any) {
    console.error("[login]", err);
    const msg = String(err?.message || "");
    return NextResponse.json(
      { error: msg.includes("AUTH_SECRET") ? msg : "Erro interno" },
      { status: 500 },
    );
  }
}
