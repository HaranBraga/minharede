import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function requireAdminLike() {
  const me = await getCurrentUser();
  if (!me) return { err: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), me: null };
  if (!me.isAdmin && me.roleLevel !== 0) {
    return { err: NextResponse.json({ error: "Apenas admin" }, { status: 403 }), me: null };
  }
  return { err: null, me };
}

export async function GET() {
  const { err } = await requireAdminLike();
  if (err) return err;

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, username: true, isAdmin: true, active: true, lastLogin: true, contactId: true,
      contact: {
        select: {
          id: true, name: true, publicSlug: true,
          role: { select: { label: true, color: true, bgColor: true, level: true } },
        },
      },
    },
    orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
  });
  return NextResponse.json(users);
}

/**
 * POST /api/admin/users
 * Body: { name, username, password, isAdmin?, active?, contactId? }
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdminLike();
  if (err) return err;

  const { name, username, password, isAdmin = false, active = true, contactId } = await req.json().catch(() => ({}));
  if (!name?.trim() || !username?.trim() || !password) {
    return NextResponse.json({ error: "Nome, usuário e senha são obrigatórios" }, { status: 400 });
  }
  const uname = String(username).toLowerCase().trim();
  if (!USERNAME_RE.test(uname)) {
    return NextResponse.json({ error: "Usuário inválido (3-32 chars: a-z 0-9 . _ -)" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha mínima 6 caracteres" }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { username: uname } })) {
    return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
  }
  if (contactId) {
    const taken = await prisma.user.findUnique({ where: { contactId } });
    if (taken) return NextResponse.json({ error: "Esse contato já está vinculado a outro usuário" }, { status: 409 });
  }

  const created = await prisma.user.create({
    data: {
      name: name.trim(),
      username: uname,
      password: await hashPassword(password),
      isAdmin: !!isAdmin,
      active: !!active,
      contactId: contactId || null,
      modules: [],
    },
    select: { id: true, name: true, username: true, isAdmin: true, active: true, contactId: true },
  });
  return NextResponse.json(created, { status: 201 });
}
