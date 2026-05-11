import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, descendantContactIds, rolesAllowedToCreate } from "@/lib/auth";
import {
  getCoordRoleId, publicLink, uniqueSlug, uniqueUsername,
  buildPersonalFields, normalizePhone, DEFAULT_USER_PASSWORD,
} from "@/lib/rede";

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

/**
 * POST /api/coordinators
 * Cria Contact (coord) + RedeUser (login automático com senha 123456).
 *
 * Body: { name*, phone*, email?, dataNascimento?, genero?, rua?, bairro?,
 *         cidade?, zona?, username?, password? }
 *  - username default: slug do nome (com sufixo se colidir)
 *  - password default: 123456
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = await rolesAllowedToCreate(s);
  if (1 < allowed.minLevel) {
    return NextResponse.json({ error: "Você não tem permissão pra criar coordenadores" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, phone } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  const phoneClean = normalizePhone(phone);
  if (!phoneClean) return NextResponse.json({ error: "Telefone obrigatório (10 ou 11 dígitos)" }, { status: 400 });

  // Phone duplicado?
  const phoneTaken = await prisma.contact.findUnique({ where: { phone: phoneClean } });
  if (phoneTaken) return NextResponse.json({ error: `Telefone já cadastrado: ${phoneTaken.name}` }, { status: 409 });

  const coordRole = await getCoordRoleId();
  const trimmed = String(name).trim().toUpperCase();

  const nameDup = await prisma.contact.findFirst({
    where: { roleId: coordRole, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (nameDup) return NextResponse.json({ error: "Coordenador já existe no sistema." }, { status: 400 });

  const parentId = s.type === "admin" ? null : s.contactId;
  const slug = await uniqueSlug(trimmed);
  const personal = buildPersonalFields(body);

  // Username + senha
  const username = body.username?.trim().toLowerCase() || await uniqueUsername(trimmed);
  const password = body.password?.trim() || DEFAULT_USER_PASSWORD;
  const usernameTaken = await prisma.redeUser.findUnique({ where: { username } });
  if (usernameTaken) return NextResponse.json({ error: `Usuário já existe: ${username}` }, { status: 409 });

  const result = await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        name: trimmed,
        phone: phoneClean,
        publicSlug: slug,
        roleId: coordRole,
        parentId,
        source: "rede",
        ...personal,
      },
      select: { id: true, name: true, publicSlug: true },
    });
    await tx.redeUser.create({
      data: {
        contactId: contact.id,
        username,
        password: await bcrypt.hash(password, 10),
      },
    });
    return contact;
  });

  const base = baseUrl(req);
  return NextResponse.json(
    {
      id: result.id, name: result.name,
      link: publicLink(base, "coord", result.publicSlug ?? result.name),
      login: { username, defaultPassword: body.password ? null : DEFAULT_USER_PASSWORD },
    },
    { status: 201 },
  );
}
