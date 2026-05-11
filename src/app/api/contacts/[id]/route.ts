import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canManageContact } from "@/lib/auth";
import { getCoordRoleId, publicLink, uniqueSlug } from "@/lib/rede";
import { upperOrNull } from "@/lib/contact-normalize";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * PUT /api/contacts/:id — edição UNIFICADA de qualquer Contact da rede
 * (coord, líder ou apoiador). Aceita todos os campos relevantes.
 *
 * Body opcional: { name, phone, email, dataNascimento, genero, rua,
 *                  bairro, cidade, zona, coordinator (admin only) }
 *
 * Permissão: usuário precisa poder gerenciar o contato (canManageContact).
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!await canManageContact(s, params.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (body.name !== undefined) {
    const trimmed = String(body.name).trim();
    if (!trimmed) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    data.name = trimmed.toUpperCase();
    data.publicSlug = await uniqueSlug(data.name, params.id);
  }
  if (body.phone !== undefined) {
    const d = String(body.phone).replace(/\D/g, "");
    if (!d) {
      data.phone = `placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    } else {
      data.phone = d.startsWith("55") ? d : `55${d}`;
      const exists = await prisma.contact.findFirst({
        where: { phone: data.phone, NOT: { id: params.id } },
        select: { id: true, name: true },
      });
      if (exists) return NextResponse.json({ error: `Telefone já cadastrado: ${exists.name}` }, { status: 409 });
    }
  }
  if (body.email !== undefined) data.email = body.email || null;
  if (body.cidade !== undefined) data.cidade = upperOrNull(body.cidade);
  if (body.bairro !== undefined) data.bairro = upperOrNull(body.bairro);
  if (body.rua !== undefined)    data.rua    = upperOrNull(body.rua);
  if (body.zona !== undefined)   data.zona   = upperOrNull(body.zona);
  if (body.genero !== undefined) data.genero = upperOrNull(body.genero);
  if (body.dataNascimento !== undefined) {
    data.dataNascimento = body.dataNascimento ? new Date(body.dataNascimento) : null;
  }

  // Mudança de cargo: só admin ou coord/coord-grupo (level <= 1)
  if (body.roleId) {
    const sessionLevel = s.type === "admin" ? -1 : s.roleLevel;
    if (sessionLevel > 1) {
      return NextResponse.json({ error: "Sem permissão pra mudar cargo" }, { status: 403 });
    }
    const newRole = await prisma.personRole.findUnique({
      where: { id: body.roleId },
      select: { id: true, level: true },
    });
    if (!newRole) return NextResponse.json({ error: "Cargo inválido" }, { status: 400 });
    // Não pode promover acima do próprio nível
    if (newRole.level < sessionLevel + 1 && s.type !== "admin") {
      return NextResponse.json({ error: "Não pode promover acima do seu cargo" }, { status: 403 });
    }
    data.roleId = newRole.id;

    // Se o cargo mudou pra um nível >= ao do parent atual, limpa o parent
    // (parent precisa ter nível menor que o contato pra hierarquia bater).
    const current = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { parentId: true, parent: { select: { role: { select: { level: true } } } } },
    });
    if (current?.parent && current.parent.role.level >= newRole.level) {
      data.parentId = null;
    }
  }

  // Apenas admin pode reatribuir parent (coordinator)
  if (s.type === "admin" && body.coordinator !== undefined) {
    const coordRole = await getCoordRoleId();
    let parentId: string | null = null;
    if (body.coordinator?.trim()) {
      const parent = await prisma.contact.findFirst({
        where: {
          roleId: coordRole,
          OR: [
            { name: { equals: body.coordinator.trim(), mode: "insensitive" } },
            { publicSlug: body.coordinator.trim().toLowerCase() },
          ],
        },
        select: { id: true },
      });
      parentId = parent?.id ?? null;
    }
    data.parentId = parentId;
  }

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data,
    select: {
      id: true, name: true, phone: true, email: true, publicSlug: true,
      cidade: true, bairro: true, rua: true, zona: true, genero: true, dataNascimento: true,
      role: { select: { id: true, key: true, label: true, level: true, color: true, bgColor: true } },
      parent: { select: { id: true, name: true } },
    },
  });

  const base = baseUrl(req);
  const linkKind = updated.role.level <= 1 ? "coord" : "lider";
  return NextResponse.json({
    ...updated,
    link: publicLink(base, linkKind, updated.publicSlug ?? updated.name),
    coordinator: updated.parent?.name ?? "",
  });
}

/** GET completo (todos os campos) — usado pra abrir modal de edição. */
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!await canManageContact(s, params.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const c = await prisma.contact.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, phone: true, email: true, publicSlug: true,
      cidade: true, bairro: true, rua: true, zona: true, genero: true, dataNascimento: true,
      role: { select: { id: true, key: true, label: true, level: true, color: true, bgColor: true } },
      parent: { select: { id: true, name: true } },
      redeUser: { select: { id: true, username: true, active: true } },
    },
  });
  if (!c) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(c);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!await canManageContact(s, params.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  // Se for coord ou líder, desvincula filhos antes de excluir
  await prisma.contact.updateMany({
    where: { parentId: params.id },
    data: { parentId: null },
  });
  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
