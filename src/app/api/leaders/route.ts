import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, descendantContactIds, rolesAllowedToCreate } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, placeholderPhone, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * GET /api/leaders
 * Lista os líderes que o user pode ver:
 *  - admin / coord grupo: todos
 *  - coord: líderes vinculados a ele (descendentes diretos)
 *  - líder: NÃO usa esse endpoint (líder vê apoiadores via outro endpoint)
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const liderRole = await getLiderRoleId();
  const where: any = { roleId: liderRole };

  const allowed = await descendantContactIds(me);
  if (allowed !== "all") {
    where.id = { in: allowed };
  }

  const rows = await prisma.contact.findMany({
    where,
    select: {
      id: true, name: true, publicSlug: true,
      parent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const base = baseUrl(req);
  return NextResponse.json({
    data: rows.map(r => ({
      id: r.id, name: r.name,
      link: publicLink(base, "lider", r.publicSlug ?? r.name),
      coordinator: r.parent?.name ?? "",
    })),
  });
}

/**
 * POST /api/leaders
 * Cria um líder. parentId padrão = contato do user atual (líder novo
 * fica abaixo dele). Validação: user precisa poder criar nível LIDER (2)
 * acima do dele.
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, coordinator: coordName } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const liderRole = await getLiderRoleId();
  const liderLevel = 2;
  const allowed = rolesAllowedToCreate(me);
  if (liderLevel < allowed.minLevel) {
    return NextResponse.json({ error: "Você não tem permissão pra criar líderes" }, { status: 403 });
  }

  const trimmed = String(name).trim();
  const coordRole = await getCoordRoleId();

  // Resolve parent (coordenador):
  // - admin/coord grupo: pode escolher qualquer coord (ou nenhum)
  // - coord: ignora `coordinator`, vincula a si mesmo
  // - líder: não chega aqui (não tem permissão)
  let parentId: string | null = null;
  if (me.roleLevel === 1) {
    // user é coord → vincula a ele
    parentId = me.contactId;
  } else if (coordName?.trim()) {
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
  } else if (me.roleLevel === 0 || me.isAdmin) {
    parentId = null; // admin/coord grupo pode criar líder solto
  }

  // Líder duplicado por nome?
  const existing = await prisma.contact.findFirst({
    where: { roleId: liderRole, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Líder já existe no sistema." }, { status: 400 });

  const slug = await uniqueSlug(trimmed);
  const created = await prisma.contact.create({
    data: {
      name: trimmed,
      phone: placeholderPhone(),
      publicSlug: slug,
      roleId: liderRole,
      parentId,
      source: "rede",
    },
    select: {
      id: true, name: true, publicSlug: true,
      parent: { select: { name: true } },
    },
  });

  const base = baseUrl(req);
  return NextResponse.json(
    {
      id: created.id, name: created.name,
      link: publicLink(base, "lider", created.publicSlug ?? created.name),
      coordinator: created.parent?.name ?? "",
    },
    { status: 201 },
  );
}
