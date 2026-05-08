import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { logRedeLogin } from "@/lib/rede-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Login por nome (sem senha — igual formelider antigo).
 *
 * Aceita { name } e busca um Contact cujo publicSlug ou nome bata,
 * cuja role.level seja <= 2 (apenas Coord Grupo, Coord, Líder podem
 * logar — apoiador NÃO).
 */
export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Informe seu nome" }, { status: 400 });

  const trimmed = String(name).trim();
  const slug = slugify(trimmed);

  const contact = await prisma.contact.findFirst({
    where: {
      role: { level: { lte: 2 } },
      OR: [
        { publicSlug: slug },
        { name: { equals: trimmed, mode: "insensitive" } },
      ],
    },
    include: { role: true },
  });

  if (!contact) {
    return NextResponse.json({ error: "Não encontrado na rede" }, { status: 404 });
  }

  await logRedeLogin({ type: "member", actorName: contact.name, contactId: contact.id, req });

  const token = await signSession({
    type: "member",
    contactId: contact.id,
    slug: contact.publicSlug ?? slug,
    name: contact.name,
    roleLevel: contact.role.level,
  });
  const res = NextResponse.json({
    ok: true,
    contact: {
      id: contact.id, name: contact.name, slug: contact.publicSlug ?? slug,
      roleLabel: contact.role.label, roleLevel: contact.role.level,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
