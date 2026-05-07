import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, descendantContactIds } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Retorna a "rede" do user atual em formato pronto pra renderização hierárquica:
 *  - admin / coord grupo: rede inteira (todos os Contacts)
 *  - outros: descendentes recursivos do contato vinculado (incluindo ele)
 *
 * Resposta: { rootContactId, rootName, contacts: [...], canCreate: boolean }
 */
export async function GET(_req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = await descendantContactIds(me);

  const where: any = allowed === "all" ? {} : { id: { in: allowed } };
  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true, name: true, phone: true, publicSlug: true, parentId: true,
      cidade: true, bairro: true, zona: true, createdAt: true,
      role: { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
      _count: { select: { children: true } },
    },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json({
    rootContactId: me.contactId,
    rootName: me.contactName,
    rootRoleLevel: me.roleLevel,
    iAmAdmin: me.isAdmin,
    iAmCoordGrupo: me.roleLevel === 0,
    contacts,
  });
}
