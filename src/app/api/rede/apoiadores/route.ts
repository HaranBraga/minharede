import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, descendantContactIds } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT = {
  id: true, name: true, phone: true, publicSlug: true, parentId: true,
  cidade: true, bairro: true, zona: true, createdAt: true,
  role: { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
  _count: { select: { children: true } },
} as const;

/**
 * Lazy-load de apoiadores (level >= 3).
 *
 * Query params:
 *  ?parentId=X   → apoiadores diretos de X
 *  ?subtreeOf=X  → todos apoiadores recursivos abaixo de X
 *  ?all=1        → todos apoiadores (admin only)
 */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = await descendantContactIds(s);
  const { searchParams } = new URL(req.url);

  const parentId  = searchParams.get("parentId");
  const subtreeOf = searchParams.get("subtreeOf");
  const all       = searchParams.get("all") === "1";

  // IDs dos roles de apoiador (level >= 3)
  const apoiadorRoles = await prisma.personRole.findMany({
    where: { level: { gte: 3 } },
    select: { id: true },
  });
  const apoiadorRoleIds = apoiadorRoles.map(r => r.id);

  function isAllowed(id: string): boolean {
    return allowed === "all" || (allowed as string[]).includes(id);
  }

  if (parentId) {
    if (!isAllowed(parentId)) return NextResponse.json([]);
    const apoiadores = await prisma.contact.findMany({
      where: { parentId, roleId: { in: apoiadorRoleIds } },
      select: SELECT,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(apoiadores);
  }

  if (all) {
    if (s.type !== "admin") return NextResponse.json({ error: "Proibido" }, { status: 403 });
    const apoiadores = await prisma.contact.findMany({
      where: { roleId: { in: apoiadorRoleIds } },
      select: SELECT,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(apoiadores);
  }

  if (subtreeOf) {
    if (!isAllowed(subtreeOf)) return NextResponse.json([]);

    // BFS em não-apoiadores pra coletar todos os pais válidos da subárvore
    const visited = new Set<string>([subtreeOf]);
    let frontier = [subtreeOf];
    while (frontier.length) {
      const children = await prisma.contact.findMany({
        where: { parentId: { in: frontier }, roleId: { notIn: apoiadorRoleIds } },
        select: { id: true },
      });
      const next: string[] = [];
      for (const c of children) {
        if (!visited.has(c.id)) { visited.add(c.id); next.push(c.id); }
      }
      frontier = next;
    }

    // Filtra pelos IDs permitidos (para membros não-admin)
    const subtreeIds = allowed === "all"
      ? Array.from(visited)
      : Array.from(visited).filter(id => (allowed as string[]).includes(id));

    const apoiadores = await prisma.contact.findMany({
      where: { parentId: { in: subtreeIds }, roleId: { in: apoiadorRoleIds } },
      select: SELECT,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(apoiadores);
  }

  return NextResponse.json({ error: "Parâmetro obrigatório: parentId, subtreeOf ou all=1" }, { status: 400 });
}
