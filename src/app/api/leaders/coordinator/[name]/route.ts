import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, publicLink } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * GET /api/leaders/coordinator/:name
 * Lista os líderes de um coord específico (busca por nome).
 * Só admin ou o próprio coord pode acessar.
 */
export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const coordRole = await getCoordRoleId();
  const decoded = decodeURIComponent(params.name);
  const coord = await prisma.contact.findFirst({
    where: {
      roleId: coordRole,
      OR: [
        { name: { equals: decoded, mode: "insensitive" } },
        { publicSlug: decoded.toLowerCase() },
      ],
    },
    select: { id: true },
  });
  if (!coord) return NextResponse.json({ data: [] });

  if (session.type === "coord" && session.contactId !== coord.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const liderRole = await getLiderRoleId();
  const rows = await prisma.contact.findMany({
    where: { roleId: liderRole, parentId: coord.id },
    select: { id: true, name: true, publicSlug: true, parent: { select: { name: true } } },
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
