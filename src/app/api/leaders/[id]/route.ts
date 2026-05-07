import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (session?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { name, coordinator: coordName } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Name and Link are required." }, { status: 400 });

  const trimmed = String(name).trim();
  const newSlug = await uniqueSlug(trimmed, params.id);

  let parentId: string | null = null;
  if (coordName?.trim()) {
    const coordRole = await getCoordRoleId();
    const parent = await prisma.contact.findFirst({
      where: {
        roleId: coordRole,
        OR: [
          { name: { equals: coordName.trim(), mode: "insensitive" } },
          { publicSlug: coordName.trim().toLowerCase() },
        ],
      },
      select: { id: true },
    });
    parentId = parent?.id ?? null;
  }

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: { name: trimmed, publicSlug: newSlug, parentId },
    select: {
      id: true, name: true, publicSlug: true,
      parent: { select: { name: true } },
    },
  });

  const base = baseUrl(req);
  return NextResponse.json({
    id: updated.id, name: updated.name,
    link: publicLink(base, "lider", updated.publicSlug ?? updated.name),
    coordinator: updated.parent?.name ?? "",
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Coord só pode excluir líder DELE
  if (session.type === "coord") {
    const cur = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { parentId: true },
    });
    if (!cur || cur.parentId !== session.contactId) {
      return NextResponse.json({ error: "Líder não encontrado ou sem permissão." }, { status: 404 });
    }
  }

  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "Líder excluído com sucesso." });
}
