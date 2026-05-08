import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, descendantContactIds, rolesAllowedToCreate } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, placeholderPhone, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const liderRole = await getLiderRoleId();
  const where: any = { roleId: liderRole };
  const allowed = await descendantContactIds(s);
  if (allowed !== "all") where.id = { in: allowed };

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

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = rolesAllowedToCreate(s);
  if (2 < allowed.minLevel) {
    return NextResponse.json({ error: "Você não tem permissão pra criar líderes" }, { status: 403 });
  }

  const { name, coordinator: coordName } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const liderRole = await getLiderRoleId();
  const coordRole = await getCoordRoleId();
  const trimmed = String(name).trim();

  // parent: admin pode escolher; member coord vincula a si; outros sem parent
  let parentId: string | null = null;
  if (s.type === "admin" && coordName?.trim()) {
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
  } else if (s.type === "member" && s.roleLevel === 1) {
    parentId = s.contactId;
  } else if (s.type === "member" && s.roleLevel === 0) {
    // coord grupo pode criar líder solto ou abaixo de coord — sem coord param fica solto
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
  }

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
