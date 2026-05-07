import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { name } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const trimmed = String(name).trim();
  const newSlug = await uniqueSlug(trimmed, params.id);
  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: { name: trimmed, publicSlug: newSlug },
    select: { id: true, name: true, publicSlug: true },
  });

  const base = baseUrl(req);
  return NextResponse.json({
    id: updated.id, name: updated.name,
    link: publicLink(base, "coord", updated.publicSlug ?? updated.name),
  });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  // Líderes vinculados não são excluídos — apenas desvinculados (parentId=null)
  const coordRole = await getCoordRoleId();
  await prisma.contact.updateMany({
    where: { parentId: params.id },
    data: { parentId: null },
  });
  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "Coordenador excluído com sucesso." });
}
