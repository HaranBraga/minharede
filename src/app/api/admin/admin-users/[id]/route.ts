import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function requireSuperAdmin() {
  const s = await getSession();
  if (s?.type !== "admin") {
    return { err: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), s: null };
  }
  const isSuper = s.isSuperAdmin === true || !s.adminUserId;
  if (!isSuper) {
    return { err: NextResponse.json({ error: "Apenas super-admin" }, { status: 403 }), s: null };
  }
  return { err: null, s };
}

/** PUT /api/admin/admin-users/[id]
 *  Body opcional: { username?, password?, name?, isSuperAdmin?, active? } */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { err, s } = await requireSuperAdmin();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (body.username !== undefined) {
    const u = String(body.username).trim().toLowerCase();
    if (!USERNAME_RE.test(u)) {
      return NextResponse.json({ error: "Usuário inválido" }, { status: 400 });
    }
    const taken = await prisma.redeAdminUser.findFirst({
      where: { username: u, NOT: { id: params.id } },
    });
    if (taken) return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
    data.username = u;
  }
  if (body.password) {
    if (String(body.password).length < 6) {
      return NextResponse.json({ error: "Senha mínima 6 caracteres" }, { status: 400 });
    }
    data.password = await bcrypt.hash(String(body.password), 10);
  }
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    data.name = n;
  }
  if (body.isSuperAdmin !== undefined) data.isSuperAdmin = body.isSuperAdmin === true;
  if (body.active !== undefined) data.active = body.active === true;

  // Proteção: não pode tirar super-admin de si mesmo (evita travar-se fora)
  if (s?.adminUserId === params.id && data.isSuperAdmin === false) {
    return NextResponse.json({ error: "Você não pode rebaixar a si mesmo" }, { status: 400 });
  }
  if (s?.adminUserId === params.id && data.active === false) {
    return NextResponse.json({ error: "Você não pode desativar a si mesmo" }, { status: 400 });
  }

  const user = await prisma.redeAdminUser.update({
    where: { id: params.id },
    data,
    select: { id: true, username: true, name: true, isSuperAdmin: true, active: true, lastLogin: true, createdAt: true },
  });
  return NextResponse.json(user);
}

/** DELETE /api/admin/admin-users/[id] */
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { err, s } = await requireSuperAdmin();
  if (err) return err;

  if (s?.adminUserId === params.id) {
    return NextResponse.json({ error: "Você não pode excluir a si mesmo" }, { status: 400 });
  }

  await prisma.redeAdminUser.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
