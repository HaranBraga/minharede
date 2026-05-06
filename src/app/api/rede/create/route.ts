import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uniqueSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cria um Contact abaixo do user atual.
 *
 * Body: { name, phone?, roleId, parentId? }
 *  - parentId default = user.contactId (cria filho direto)
 *  - validação: roleId.level > user.roleLevel (só cria níveis abaixo)
 *  - admin pode criar em qualquer nível e parent
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { name, phone, roleId } = body;
  let { parentId } = body;
  if (!name?.trim() || !roleId) {
    return NextResponse.json({ error: "Nome e cargo obrigatórios" }, { status: 400 });
  }

  const role = await prisma.personRole.findUnique({ where: { id: roleId } });
  if (!role) return NextResponse.json({ error: "Cargo inválido" }, { status: 400 });

  // Não-admin: só cria níveis abaixo do dele e o parent precisa ser ele ou descendente
  if (!me.isAdmin) {
    if (me.roleLevel == null) {
      return NextResponse.json({ error: "Você não tem cargo associado — peça ao admin" }, { status: 403 });
    }
    if (role.level <= me.roleLevel) {
      return NextResponse.json({ error: "Você só pode criar níveis abaixo do seu" }, { status: 403 });
    }
    if (!parentId) parentId = me.contactId;
    if (parentId !== me.contactId) {
      // valida que parentId é descendente do me.contactId (BFS limitado)
      const isDescendant = await isDescendantOf(parentId, me.contactId!);
      if (!isDescendant) {
        return NextResponse.json({ error: "Sem permissão pra criar nesse ramo" }, { status: 403 });
      }
    }
  }

  // Phone único: se vier, normaliza pra 55+...
  let phoneClean: string | undefined;
  if (phone?.trim()) {
    const d = String(phone).replace(/\D/g, "");
    phoneClean = d.startsWith("55") ? d : `55${d}`;
    const existing = await prisma.contact.findUnique({ where: { phone: phoneClean } });
    if (existing) {
      return NextResponse.json({ error: `Telefone já cadastrado: ${existing.name}` }, { status: 409 });
    }
  } else {
    // sem phone: gera placeholder único pra satisfazer @unique
    phoneClean = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const slug = await uniqueSlug(name);
  const contact = await prisma.contact.create({
    data: {
      name: name.trim(),
      phone: phoneClean,
      publicSlug: slug,
      roleId,
      parentId: parentId ?? null,
      source: "rede",
    },
    include: {
      role:   { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
      parent: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ contact }, { status: 201 });
}

async function isDescendantOf(targetId: string, ancestorId: string): Promise<boolean> {
  let current: string | null = targetId;
  for (let i = 0; i < 6 && current; i++) {
    if (current === ancestorId) return true;
    const c: any = await prisma.contact.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = c?.parentId ?? null;
  }
  return false;
}
