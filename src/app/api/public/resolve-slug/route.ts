import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Resolve um slug público (vindo de ?lider=X ou ?coord=X) num Contact.
 * Tenta primeiro por publicSlug exato; fallback por nome (case-insensitive)
 * pra continuar pegando links antigos que usam o nome cru.
 *
 * Retorna { id, name, slug, role: { label, level }, parent: { id, name } | null }
 * ou 404.
 */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get("slug")?.trim();
  if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });

  const where = {
    OR: [
      { publicSlug: slug.toLowerCase() },
      { name: { equals: slug, mode: "insensitive" as const } },
      { name: { equals: slug.replace(/-/g, " "), mode: "insensitive" as const } },
    ],
  };

  const contact = await prisma.contact.findFirst({
    where,
    select: {
      id: true, name: true, publicSlug: true,
      role:   { select: { id: true, key: true, label: true, level: true } },
      parent: { select: { id: true, name: true, publicSlug: true, role: { select: { label: true, level: true } } } },
    },
  });
  if (!contact) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  return NextResponse.json({ contact });
}
