import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Login pelo nome (sem senha). Só funciona pra contatos que NÃO têm
 * RedeUser configurado — quando admin cria credenciais, esse contato
 * passa a exigir senha via /api/auth/login.
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
    include: { role: true, redeUser: { select: { id: true } } },
  });

  if (!contact) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  if (contact.redeUser) {
    // Tem credenciais configuradas — exige login com senha
    return NextResponse.json({ error: "needs_password", username: null }, { status: 401 });
  }

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
