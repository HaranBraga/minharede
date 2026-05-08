import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, descendantContactIds, rolesAllowedToCreate } from "@/lib/auth";
import { getCoordRoleId, placeholderPhone, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ data: [] });

  const coordRole = await getCoordRoleId();
  const where: any = { roleId: coordRole };
  const allowed = await descendantContactIds(s);
  if (allowed !== "all") where.id = { in: allowed };

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

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const allowed = rolesAllowedToCreate(s);
  if (1 < allowed.minLevel) {
    return NextResponse.json({ error: "Sem permissão pra criar coordenador" }, { status: 403 });
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

  const parentId = s.type === "admin" ? null : s.contactId;

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
