import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLiderRoleId, publicLink } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * GET /api/leaders/by-name/:name — público (chamado pelo formulário do
 * apoiador pra descobrir qual coordenador está vinculado ao líder).
 */
export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const liderRole = await getLiderRoleId();
  const decoded = decodeURIComponent(params.name);
  const lider = await prisma.contact.findFirst({
    where: {
      roleId: liderRole,
      OR: [
        { publicSlug: decoded.toLowerCase() },
        { name: { equals: decoded, mode: "insensitive" } },
      ],
    },
    select: {
      id: true, name: true, publicSlug: true,
      parent: { select: { name: true, publicSlug: true } },
    },
  });
  if (!lider) return NextResponse.json({ error: "Líder não encontrado." }, { status: 404 });

  const base = baseUrl(req);
  return NextResponse.json({
    data: {
      id: lider.id,
      name: lider.name,
      link: publicLink(base, "lider", lider.publicSlug ?? lider.name),
      coordinator: lider.parent?.name ?? "",
    },
  });
}
