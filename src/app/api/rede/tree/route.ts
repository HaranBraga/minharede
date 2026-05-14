import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, descendantContactIds } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Versão leve de /api/rede: retorna apenas contacts com role.level < 3
 * (sem apoiadores) e um mapa apoiadorCountByParent para que o frontend
 * possa exibir as contagens corretas sem baixar a lista completa.
 *
 * Apoiadores são buscados sob demanda via /api/rede/apoiadores.
 */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = await descendantContactIds(s);
  const baseWhere: any = allowed === "all" ? {} : { id: { in: allowed } };

  // Busca os IDs de todos os PersonRole com level >= 3 (apoiadores)
  const apoiadorRoles = await prisma.personRole.findMany({
    where: { level: { gte: 3 } },
    select: { id: true, level: true, key: true, label: true, color: true, bgColor: true },
    orderBy: { level: "asc" },
  });
  const apoiadorRoleIds = apoiadorRoles.map(r => r.id);
  const apoiadorRole = apoiadorRoles[0] ?? null;

  const [nonApoiadores, apoiadorAgg] = await Promise.all([
    // Todos os contatos que não são apoiadores
    prisma.contact.findMany({
      where: { ...baseWhere, roleId: { notIn: apoiadorRoleIds } },
      select: {
        id: true, name: true, phone: true, publicSlug: true, parentId: true,
        cidade: true, bairro: true, zona: true, createdAt: true,
        role: { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
        _count: { select: { children: true } },
      },
      orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
    }),

    // Contagem de apoiadores diretos agrupada por parentId
    // Usa roleId (campo escalar) em vez de filtro por relação
    // para compatibilidade máxima com Prisma groupBy
    prisma.contact.groupBy({
      by: ["parentId"],
      where: { ...baseWhere, roleId: { in: apoiadorRoleIds } },
      _count: { id: true },
    }),
  ]);

  // Mapeia parentId → count
  const apoiadorCountByParent: Record<string, number> = {};
  let totalApoiadores = 0;
  for (const row of apoiadorAgg) {
    const count = row._count.id;
    totalApoiadores += count;
    if (row.parentId) {
      apoiadorCountByParent[row.parentId] = count;
    }
  }

  return NextResponse.json({
    rootContactId: s.type === "admin" ? null : s.contactId,
    rootName: s.type === "admin" ? null : s.name,
    rootRoleLevel: s.type === "admin" ? null : s.roleLevel,
    iAmAdmin: s.type === "admin",
    contacts: nonApoiadores,
    apoiadorCountByParent,
    totalApoiadores,
    apoiadorRole,
  });
}
