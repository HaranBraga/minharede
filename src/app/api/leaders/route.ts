import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, descendantContactIds, rolesAllowedToCreate } from "@/lib/auth";
import {
  getCoordRoleId, getLiderRoleId, publicLink, uniqueSlug, uniqueUsername,
  buildPersonalFields, normalizePhone, DEFAULT_USER_PASSWORD,
} from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const liderRole = await getLiderRoleId();
  const where: any = { roleId: liderRole };

  const allowed = await descendantContactIds(me);
  if (allowed !== "all") {
    where.id = { in: allowed };
  }

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
      id: r.id, name: r.name,
      link: publicLink(base, "lider", r.publicSlug ?? r.name),
      coordinator: r.parent?.name ?? "",
    })),
  });
}

/**
 * POST /api/leaders
 * Cria Contact (líder) + RedeUser (login automático com senha 123456).
 *
 * Body: { name*, phone*, coordinator?, email?, dataNascimento?, genero?,
 *         rua?, bairro?, cidade?, zona?, username?, password? }
 */
export async function POST(req: NextRequest) {
  const me = await getSession();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = rolesAllowedToCreate(me);
  if (2 < allowed.minLevel) {
    return NextResponse.json({ error: "Você não tem permissão pra criar líderes" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, phone, coordinator: coordName } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  const phoneClean = normalizePhone(phone);
  if (!phoneClean) return NextResponse.json({ error: "Telefone obrigatório (10 ou 11 dígitos)" }, { status: 400 });

  const phoneTaken = await prisma.contact.findUnique({ where: { phone: phoneClean } });
  if (phoneTaken) return NextResponse.json({ error: `Telefone já cadastrado: ${phoneTaken.name}` }, { status: 409 });

  const liderRole = await getLiderRoleId();
  const coordRole = await getCoordRoleId();
  const trimmed = String(name).trim().toUpperCase();

  // Resolve parent
  let parentId: string | null = null;
  if (me.type === "admin" && coordName?.trim()) {
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
  } else if (me.type === "member" && me.roleLevel === 1) {
    parentId = me.contactId;
  } else if (me.type === "member" && me.roleLevel === 0) {
    if (coordName?.trim()) {
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
  }

  const nameDup = await prisma.contact.findFirst({
    where: { roleId: liderRole, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (nameDup) return NextResponse.json({ error: "Líder já existe no sistema." }, { status: 400 });

  const slug = await uniqueSlug(trimmed);
  const personal = buildPersonalFields(body);

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
        roleId: liderRole,
        parentId,
        source: "rede",
        ...personal,
      },
      select: {
        id: true, name: true, publicSlug: true,
        parent: { select: { name: true } },
      },
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
      link: publicLink(base, "lider", result.publicSlug ?? result.name),
      coordinator: result.parent?.name ?? "",
      login: { username, defaultPassword: body.password ? null : DEFAULT_USER_PASSWORD },
    },
    { status: 201 },
  );
}
