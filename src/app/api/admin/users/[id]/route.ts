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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await requireAdminLike();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (body.name !== undefined)     data.name = String(body.name).trim();
  if (body.isAdmin !== undefined)  data.isAdmin = !!body.isAdmin;
  if (body.active !== undefined)   data.active = !!body.active;
  if (body.contactId !== undefined) data.contactId = body.contactId || null;
  if (body.username !== undefined) {
    const uname = String(body.username).toLowerCase().trim();
    if (!USERNAME_RE.test(uname)) return NextResponse.json({ error: "Usuário inválido" }, { status: 400 });
    const ex = await prisma.user.findUnique({ where: { username: uname } });
    if (ex && ex.id !== params.id) return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
    data.username = uname;
  }
  if (body.password) {
    if (String(body.password).length < 6) return NextResponse.json({ error: "Senha mínima 6 caracteres" }, { status: 400 });
    data.password = await hashPassword(body.password);
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, isAdmin: true, active: true, contactId: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { err, me } = await requireAdminLike();
  if (err) return err;
  if (me!.id === params.id) {
    return NextResponse.json({ error: "Você não pode excluir você mesmo" }, { status: 400 });
  }
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
