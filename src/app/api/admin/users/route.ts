import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { uniqueSlug, getCoordRoleId, getLiderRoleId, buildPersonalFields, normalizePhone } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function requireAdmin() {
  const s = await getSession();
  if (!s) return { err: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), s: null };
  if (s.type !== "admin") return { err: NextResponse.json({ error: "Apenas admin" }, { status: 403 }), s: null };
  return { err: null, s };
}

/**
 * GET /api/admin/users
 * Lista todos os RedeUser com Contact + role + parent.
 */
export async function GET() {
  const { err } = await requireAdmin();
  if (err) return err;

  const users = await prisma.redeUser.findMany({
    select: {
      id: true, username: true, active: true, lastLogin: true, createdAt: true,
      contact: {
        select: {
          id: true, name: true, publicSlug: true,
          role:   { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
          parent: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

/**
 * POST /api/admin/users
 * Cria login pra um Contact existente OU cria Contact + login juntos.
 *
 * Body modo 1 (Contact existente):
 *   { contactId, username, password }
 *
 * Body modo 2 (criar Contact + login):
 *   { name, roleLevel, parentId?, parentName?, username, password,
 *     phone? }
 *   - parentId tem prioridade sobre parentName
 *   - parentName busca Contact pelo nome (case-insensitive) ou slug
 *   - se parent não vier, fica null (admin pode atribuir depois)
 *
 * roleLevel: 0=Coord Grupo, 1=Coord, 2=Líder
 */
export async function POST(req: NextRequest) {
  const { err } = await requireAdmin();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const { username } = body;

  if (!username?.trim()) {
    return NextResponse.json({ error: "Usuário é obrigatório" }, { status: 400 });
  }
  const uname = String(username).toLowerCase().trim();
  if (!USERNAME_RE.test(uname)) {
    return NextResponse.json({ error: "Usuário inválido (3-32 chars: a-z 0-9 . _ -)" }, { status: 400 });
  }
  // Senha padrão = 123456 (admin pode definir outra; user troca depois)
  const password = body.password?.trim() ? String(body.password) : "123456";
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha mínima 6 caracteres" }, { status: 400 });
  }
  if (await prisma.redeUser.findUnique({ where: { username: uname } })) {
    return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });
  }

  // Modo 1: Contact existente
  if (body.contactId) {
    const c = await prisma.contact.findUnique({
      where: { id: body.contactId },
      include: { redeUser: { select: { id: true } } },
    });
    if (!c) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
    if (c.redeUser) return NextResponse.json({ error: "Esse contato já tem login" }, { status: 409 });

    const created = await prisma.redeUser.create({
      data: {
        contactId: c.id,
        username: uname,
        password: await bcrypt.hash(password, 10),
      },
      select: { id: true, username: true, active: true, contact: { select: { id: true, name: true } } },
    });
    return NextResponse.json(created, { status: 201 });
  }

  // Modo 2: criar Contact + RedeUser juntos
  const { name, roleLevel, parentId, parentName, phone } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  if (typeof roleLevel !== "number" || roleLevel < 0 || roleLevel > 2) {
    return NextResponse.json({ error: "Cargo inválido (apenas Coord Grupo, Coord ou Líder podem ter login)" }, { status: 400 });
  }

  const phoneClean = normalizePhone(phone);
  if (!phoneClean) return NextResponse.json({ error: "Telefone obrigatório (10 ou 11 dígitos)" }, { status: 400 });
  const phoneTaken = await prisma.contact.findUnique({ where: { phone: phoneClean } });
  if (phoneTaken) return NextResponse.json({ error: `Telefone já cadastrado: ${phoneTaken.name}` }, { status: 409 });

  const role = await prisma.personRole.findFirst({
    where: {
      OR: [
        { level: roleLevel, key: roleLevel === 0 ? "COORDENADOR_GRUPO" : roleLevel === 1 ? "COORDENADOR" : "LIDER" },
        { id: roleLevel === 0 ? "role-coordenador-grupo" : roleLevel === 1 ? "role-coordenador" : "role-lider" },
      ],
    },
  });
  if (!role) return NextResponse.json({ error: "Cargo não cadastrado" }, { status: 500 });

  // Resolve parent
  let resolvedParentId: string | null = null;
  if (parentId) {
    resolvedParentId = String(parentId);
  } else if (parentName?.trim()) {
    const trimmed = String(parentName).trim();
    const p = await prisma.contact.findFirst({
      where: {
        OR: [
          { publicSlug: trimmed.toLowerCase() },
          { name: { equals: trimmed, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    resolvedParentId = p?.id ?? null;
  }

  const slug = await uniqueSlug(String(name).trim());
  const personal = buildPersonalFields(body);

  const result = await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.create({
      data: {
        name: String(name).trim(),
        phone: phoneClean,
        publicSlug: slug,
        roleId: role.id,
        parentId: resolvedParentId,
        source: "rede",
        ...personal,
      },
    });
    const ru = await tx.redeUser.create({
      data: {
        contactId: contact.id,
        username: uname,
        password: await bcrypt.hash(password, 10),
      },
    });
    return { contact, redeUser: ru };
  });

  return NextResponse.json(
    {
      id: result.redeUser.id,
      username: result.redeUser.username,
      active: result.redeUser.active,
      contact: { id: result.contact.id, name: result.contact.name },
    },
    { status: 201 },
  );
}
