import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, descendantContactIds, rolesAllowedToCreate } from "@/lib/auth";
import { getCoordRoleId, placeholderPhone, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * GET /api/coordinators
 *  - admin/coord grupo: lista todos
 *  - coord: lista só ele mesmo (pra UI de header)
 *  - líder: nada (vai aparecer só o coord pai dele, sem necessidade)
 */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ data: [] });

  const coordRole = await getCoordRoleId();
  const where: any = { roleId: coordRole };

  const allowed = await descendantContactIds(me);
  if (allowed !== "all") {
    where.id = { in: allowed };
  }

  const rows = await prisma.contact.findMany({
    where,
    select: { id: true, name: true, publicSlug: true },
    orderBy: { name: "asc" },
  });
  const base = baseUrl(req);
  return NextResponse.json({
    data: rows.map(r => ({
      id: r.id, name: r.name,
      link: publicLink(base, "coord", r.publicSlug ?? r.name),
    })),
  });
}

/**
 * POST /api/coordinators
 *  - admin/coord grupo: cria coord
 *  - outros: 403
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = rolesAllowedToCreate(me);
  if (allowed.minLevel > 1) {
    return NextResponse.json({ error: "Você não tem permissão pra criar coordenadores" }, { status: 403 });
  }

  const { name } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const coordRole = await getCoordRoleId();
  const trimmed = String(name).trim();

  const existing = await prisma.contact.findFirst({
    where: { roleId: coordRole, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Coordenador já existe no sistema." }, { status: 400 });

  // parent = se admin/coord grupo, null. Caso contrário, contactId do user.
  const parentId = (me.isAdmin || me.roleLevel === 0) ? null : me.contactId;

  const slug = await uniqueSlug(trimmed);
  const created = await prisma.contact.create({
    data: {
      name: trimmed,
      phone: placeholderPhone(),
      publicSlug: slug,
      roleId: coordRole,
      parentId,
      source: "rede",
    },
    select: { id: true, name: true, publicSlug: true },
  });

  const base = baseUrl(req);
  return NextResponse.json(
    { id: created.id, name: created.name, link: publicLink(base, "coord", created.publicSlug ?? created.name) },
    { status: 201 },
  );
}
