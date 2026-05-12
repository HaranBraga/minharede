import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canManageContact } from "@/lib/auth";
import { getCoordRoleId, publicLink } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!await canManageContact(s, params.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { name, coordinator: coordName } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const trimmed = String(name).trim().toUpperCase();
  // Não regenera publicSlug — o slug é o que sustenta o link de formulário
  // já compartilhado. Mudar o nome NÃO quebra o link existente.

  let dataExtra: any = {};
  if (s.type === "admin" && coordName !== undefined) {
    const coordRole = await getCoordRoleId();
    let parentId: string | null = null;
    if (coordName?.trim()) {
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
    dataExtra.parentId = parentId;
  }

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: { name: trimmed, ...dataExtra },
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

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!await canManageContact(s, params.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "Líder excluído com sucesso." });
}
