import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function requireAdmin() {
  const s = await getSession();
  if (!s) return { err: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), s: null };
  if (s.type !== "admin") return { err: NextResponse.json({ error: "Apenas admin" }, { status: 403 }), s: null };
  return { err: null, s };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await requireAdmin();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (body.active !== undefined) data.active = !!body.active;
  if (body.username !== undefined) {
    const uname = String(body.username).toLowerCase().trim();
    if (!USERNAME_RE.test(uname)) return NextResponse.json({ error: "Usuário inválido" }, { status: 400 });
    const ex = await prisma.redeUser.findUnique({ where: { username: uname } });
    if (ex && ex.id !== params.id) return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
    data.username = uname;
  }
  if (body.password) {
    if (String(body.password).length < 6) return NextResponse.json({ error: "Senha mínima 6 caracteres" }, { status: 400 });
    data.password = await bcrypt.hash(body.password, 10);
  }

  const updated = await prisma.redeUser.update({
    where: { id: params.id },
    data,
    select: { id: true, username: true, active: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await requireAdmin();
  if (err) return err;
  // Apenas remove o login — Contact permanece (admin pode excluir Contact pelo Rede tab)
  await prisma.redeUser.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
