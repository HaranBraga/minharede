import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canManageContact } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!await canManageContact(me, params.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { name, phone, cidade, bairro, zona, genero, dataNascimento } = body;

  const data: any = {};
  if (name?.trim())     data.name = String(name).trim();
  if (cidade !== undefined) data.cidade = cidade || null;
  if (bairro !== undefined) data.bairro = bairro || null;
  if (zona !== undefined)   data.zona = zona || null;
  if (genero !== undefined) data.genero = genero || null;
  if (dataNascimento !== undefined) {
    data.dataNascimento = dataNascimento ? new Date(dataNascimento) : null;
  }
  if (phone?.trim()) {
    const d = String(phone).replace(/\D/g, "");
    data.phone = d.startsWith("55") ? d : `55${d}`;
  }

  const updated = await prisma.contact.update({ where: { id: params.id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!await canManageContact(me, params.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
