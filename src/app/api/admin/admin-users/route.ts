import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

async function requireSuperAdmin() {
  const s = await getSession();
  if (s?.type !== "admin") {
    return { err: NextResponse.json({ error: "Não autenticado" }, { status: 401 }), s: null };
  }
  // Master (sem adminUserId) é super-admin implícito; outros precisam da flag
  const isSuper = s.isSuperAdmin === true || !s.adminUserId;
  if (!isSuper) {
    return { err: NextResponse.json({ error: "Apenas super-admin" }, { status: 403 }), s: null };
  }
  return { err: null, s };
}

/** GET /api/admin/admin-users — lista todos os admins individuais. */
export async function GET() {
  const { err } = await requireSuperAdmin();
  if (err) return err;

  const users = await prisma.redeAdminUser.findMany({
    select: {
      id: true, username: true, name: true,
      isSuperAdmin: true, active: true, lastLogin: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

/** POST /api/admin/admin-users — cria novo admin.
 *  Body: { username, password, name, isSuperAdmin? } */
export async function POST(req: NextRequest) {
  const { err } = await requireSuperAdmin();
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const isSuperAdmin = body.isSuperAdmin === true;

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: "Usuário inválido (3-32 chars: a-z 0-9 . _ -)" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Senha mínima 6 caracteres" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const taken = await prisma.redeAdminUser.findUnique({ where: { username } });
  if (taken) return NextResponse.json({ error: "Usuário já existe" }, { status: 409 });

  const user = await prisma.redeAdminUser.create({
    data: {
      username, name,
      password: await bcrypt.hash(password, 10),
      isSuperAdmin,
    },
    select: { id: true, username: true, name: true, isSuperAdmin: true, active: true, createdAt: true },
  });
  return NextResponse.json(user, { status: 201 });
}
