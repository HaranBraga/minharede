import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Retorna a "Minha Rede" do user atual = todos os descendentes recursivos
 * do Contact vinculado ao user (User.contactId), incluindo o próprio.
 *
 * Admin sem contactId vê tudo (toda a base de Contacts).
 *
 * Resposta: { rootSlug, rootName, descendants: Contact[] (em árvore aplainada) }
 */
export async function GET(_req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Admin sem contact vinculado: vê tudo
  if (me.isAdmin && !me.contactId) {
    const all = await prisma.contact.findMany({
      include: {
        role:   { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true } },
      },
      orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
    });
    return NextResponse.json({
      rootName: "Toda a base", rootSlug: null,
      iAmAdmin: true,
      descendants: all,
    });
  }

  if (!me.contactId) {
    return NextResponse.json({
      rootName: me.name, rootSlug: null,
      iAmAdmin: me.isAdmin,
      descendants: [],
      message: "Você ainda não está vinculado a um contato da rede. Peça ao admin pra vincular.",
    });
  }

  // BFS recursivo via parentId. Limite de profundidade pra segurança.
  const root = await prisma.contact.findUnique({
    where: { id: me.contactId },
    include: { role: true },
  });
  if (!root) return NextResponse.json({ error: "Contato vinculado não encontrado" }, { status: 404 });

  const visited = new Set<string>();
  const result: any[] = [];
  let frontier: string[] = [root.id];
  for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
    const children = await prisma.contact.findMany({
      where: { parentId: { in: frontier } },
      include: {
        role:   { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true } },
      },
      orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
    });
    const next: string[] = [];
    for (const c of children) {
      if (visited.has(c.id)) continue;
      visited.add(c.id);
      result.push(c);
      next.push(c.id);
    }
    frontier = next;
  }

  return NextResponse.json({
    rootName: root.name,
    rootSlug: root.publicSlug,
    rootRoleLabel: root.role.label,
    rootRoleLevel: root.role.level,
    iAmAdmin: me.isAdmin,
    descendants: result,
  });
}
