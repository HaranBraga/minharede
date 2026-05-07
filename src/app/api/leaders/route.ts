import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, placeholderPhone, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * GET /api/leaders
 *  - admin: lista tudo
 *  - coord: lista os líderes vinculados a ele (parentId = session.contactId)
 *
 * Resposta: { data: [{ id, name, link, coordinator (nome do parent) }] }
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const liderRole = await getLiderRoleId();
  const where: any = { roleId: liderRole };
  if (session.type === "coord") where.parentId = session.contactId;

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
      id: r.id,
      name: r.name,
      link: publicLink(base, "lider", r.publicSlug ?? r.name),
      coordinator: r.parent?.name ?? "",
    })),
  });
}

/**
 * POST /api/leaders
 *  - admin: pode criar líder com qualquer coord
 *  - coord: pode criar líder vinculado a si mesmo (ignora `coordinator` do body)
 *
 * Body: { name, link?, coordinator? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, coordinator: coordName } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Name and Link are required." }, { status: 400 });

  const liderRole = await getLiderRoleId();
  const coordRole = await getCoordRoleId();
  const trimmed = String(name).trim();

  // Resolve parent (coord)
  let parentId: string | null = null;
  if (session.type === "coord") {
    parentId = session.contactId;
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
  }

  // Líder duplicado?
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
