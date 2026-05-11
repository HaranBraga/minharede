import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Apaga TODOS os Contacts com source='import-planilha' e 'rede-import',
 * junto com os RedeUsers vinculados (cascade).
 *
 * Body: { confirm: "APAGAR" } — proteção contra disparo acidental.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== "APAGAR") {
    return NextResponse.json({ error: "Envie { confirm: 'APAGAR' } pra confirmar" }, { status: 400 });
  }

  // Pega IDs de todos os Contacts importados
  const toDelete = await prisma.contact.findMany({
    where: { source: { in: ["import-planilha", "rede-import"] } },
    select: { id: true, role: { select: { level: true } } },
  });
  const ids = toDelete.map(c => c.id);

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, apagados: 0, message: "Nada pra apagar" });
  }

  // Desvincula filhos NÃO-import desses contatos (set parentId = null)
  // pra evitar foreign key error.
  const updated = await prisma.contact.updateMany({
    where: {
      parentId: { in: ids },
      source: { notIn: ["import-planilha", "rede-import"] },
    },
    data: { parentId: null },
  });

  // Ordem: deletar do mais baixo (apoiador) pro mais alto (coord) pra evitar
  // erro de FK quando líder ainda referencia coord-grupo.
  const byLevel = new Map<number, string[]>();
  for (const c of toDelete) {
    const lv = c.role.level;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(c.id);
  }
  const levels = Array.from(byLevel.keys()).sort((a, b) => b - a); // desc

  let totalDeleted = 0;
  for (const lv of levels) {
    const idsLv = byLevel.get(lv)!;
    const res = await prisma.contact.deleteMany({
      where: { id: { in: idsLv } },
    });
    totalDeleted += res.count;
  }

  return NextResponse.json({
    ok: true,
    apagados: totalDeleted,
    filhosDesvinculados: updated.count,
  });
}
