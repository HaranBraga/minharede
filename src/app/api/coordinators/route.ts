import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, placeholderPhone, publicLink, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * GET /api/coordinators
 *  - admin: lista tudo
 *  - coord logado: lista só ele mesmo (pra UI conseguir mostrar nome no header)
 *  - sem sessão: lista pública (usado no login do coord pra clicar)
 *
 * Resposta: { data: [{ id, name, link }] }
 */
export async function GET(req: NextRequest) {
  const coordRole = await getCoordRoleId();
  const session = await getSession();

  let where: any = { roleId: coordRole };
  if (session?.type === "coord") where = { id: session.contactId };

  const rows = await prisma.contact.findMany({
    where,
    select: { id: true, name: true, publicSlug: true },
    orderBy: { name: "asc" },
  });
  const base = baseUrl(req);
  return NextResponse.json({
    data: rows.map(r => ({
      id: r.id,
      name: r.name,
      link: publicLink(base, "coord", r.publicSlug ?? r.name),
    })),
  });
}

/**
 * POST /api/coordinators (admin only)
 * Body: { name, link } — link é ignorado (geramos do slug).
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { name } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const coordRole = await getCoordRoleId();
  const trimmed = String(name).trim();

  // Já existe alguém com esse nome em coord?
  const existing = await prisma.contact.findFirst({
    where: { roleId: coordRole, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Coordenador já existe no sistema." }, { status: 400 });

  const slug = await uniqueSlug(trimmed);
  const created = await prisma.contact.create({
    data: {
      name: trimmed,
      phone: placeholderPhone(),
      publicSlug: slug,
      roleId: coordRole,
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
