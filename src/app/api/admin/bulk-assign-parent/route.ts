import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/bulk-assign-parent
 * Body: { ids: string[], parentId: string }
 *
 * Vincula uma lista de Contacts a um pai (parentId). Usado pra atribuir
 * coordenador a vários líderes sem vínculo de uma vez.
 *
 * Regras:
 * - Apenas admin
 * - O pai precisa ter nível menor que todos os contatos selecionados
 *   (ex: coord pode ser pai de líder, mas líder não pode ser pai de coord)
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === "string") : [];
  const parentId: string | null = body.parentId === null ? null : (typeof body.parentId === "string" ? body.parentId : null);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhum contato selecionado" }, { status: 400 });
  }

  // Se parentId vem null, é "desvincular" — permitido sempre
  if (parentId === null) {
    const r = await prisma.contact.updateMany({
      where: { id: { in: ids } },
      data: { parentId: null },
    });
    return NextResponse.json({ ok: true, atualizados: r.count });
  }

  // Valida pai
  const parent = await prisma.contact.findUnique({
    where: { id: parentId },
    select: { id: true, name: true, role: { select: { level: true, label: true } } },
  });
  if (!parent) return NextResponse.json({ error: "Pai não encontrado" }, { status: 404 });

  // Valida que todos os filhos têm nível > pai
  const children = await prisma.contact.findMany({
    where: { id: { in: ids } },
    select: { id: true, role: { select: { level: true } } },
  });
  if (children.length === 0) {
    return NextResponse.json({ error: "Nenhum contato encontrado" }, { status: 404 });
  }
  const invalid = children.filter(c => c.role.level <= parent.role.level);
  if (invalid.length > 0) {
    return NextResponse.json({
      error: `${invalid.length} contato(s) têm cargo igual ou superior a ${parent.role.label}. Só dá pra vincular abaixo.`,
    }, { status: 400 });
  }

  // Não pode ser pai de si mesmo
  if (ids.includes(parentId)) {
    return NextResponse.json({ error: "Um contato não pode ser pai dele mesmo" }, { status: 400 });
  }

  const r = await prisma.contact.updateMany({
    where: { id: { in: ids } },
    data: { parentId },
  });

  return NextResponse.json({ ok: true, atualizados: r.count, parent: parent.name });
}
