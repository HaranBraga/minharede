import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, descendantContactIds, rolesAllowedToCreate } from "@/lib/auth";
import { placeholderPhone, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getApoiadorRoleId(): Promise<string | null> {
  const r = await prisma.personRole.findFirst({
    where: { OR: [{ key: "APOIADOR" }, { id: "role-apoiador" }] },
    select: { id: true },
  });
  return r?.id ?? null;
}

/**
 * GET /api/apoiadores
 * Lista apoiadores que o user pode ver:
 *  - admin/coord grupo: todos
 *  - coord: apoiadores de qualquer líder dele (descendentes recursivos)
 *  - líder: apoiadores diretos dele (parentId = me.contactId)
 */
export async function GET(_req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const roleId = await getApoiadorRoleId();
  if (!roleId) return NextResponse.json({ data: [] });

  const where: any = { roleId };
  const allowed = await descendantContactIds(me);
  if (allowed !== "all") where.id = { in: allowed };

  const rows = await prisma.contact.findMany({
    where,
    select: {
      id: true, name: true, phone: true, cidade: true, bairro: true, zona: true,
      dataNascimento: true, genero: true, lastContactAt: true, createdAt: true,
      parent: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: rows });
}

/**
 * POST /api/apoiadores (líder e acima)
 * Body: { name, phone?, parentId? }
 *   parentId padrão: contato do user (líder cria abaixo dele)
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const roleId = await getApoiadorRoleId();
  if (!roleId) return NextResponse.json({ error: "Cargo de apoiador não configurado" }, { status: 500 });

  const apoiadorLevel = 3;
  const allowed = rolesAllowedToCreate(me);
  if (apoiadorLevel < allowed.minLevel) {
    return NextResponse.json({ error: "Você não tem permissão" }, { status: 403 });
  }

  const { name, phone, parentId } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  // parent default = contactId do user
  let resolvedParent = parentId ?? me.contactId ?? null;

  let phoneClean: string | undefined;
  if (phone?.trim()) {
    const d = String(phone).replace(/\D/g, "");
    phoneClean = d.startsWith("55") ? d : `55${d}`;
    const exists = await prisma.contact.findUnique({ where: { phone: phoneClean } });
    if (exists) return NextResponse.json({ error: `Telefone já cadastrado: ${exists.name}` }, { status: 409 });
  } else {
    phoneClean = placeholderPhone();
  }

  const slug = await uniqueSlug(name);
  const created = await prisma.contact.create({
    data: {
      name: String(name).trim(),
      phone: phoneClean,
      publicSlug: slug,
      roleId,
      parentId: resolvedParent,
      source: "rede",
    },
    select: { id: true, name: true, parent: { select: { id: true, name: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}
