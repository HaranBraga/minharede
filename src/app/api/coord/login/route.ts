import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Login do coordenador SEM senha (igual formelider).
 * Aceita { name } e busca um Contact com role=COORDENADOR cujo
 * publicSlug ou nome bata. Se achou → emite cookie de coord.
 */
export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Informe seu nome" }, { status: 400 });

  const trimmed = String(name).trim();
  const slug = slugify(trimmed);

  const coord = await prisma.contact.findFirst({
    where: {
      AND: [
        { role: { OR: [{ key: "COORDENADOR" }, { id: "role-coordenador" }] } },
        {
          OR: [
            { publicSlug: slug },
            { name: { equals: trimmed, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, name: true, publicSlug: true },
  });

  if (!coord) {
    return NextResponse.json({ error: "Coordenador não encontrado" }, { status: 404 });
  }

  const token = await signSession({
    type: "coord",
    contactId: coord.id,
    slug: coord.publicSlug ?? slug,
    name: coord.name,
  });
  const res = NextResponse.json({ ok: true, coord: { name: coord.name, slug: coord.publicSlug ?? slug } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
