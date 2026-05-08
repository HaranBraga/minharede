import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Troca a senha do próprio user (member). Não funciona pra admin
 * (admin é env var ADMIN_PASSWORD).
 *
 * Body: { currentPassword, newPassword }
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (s.type !== "member") {
    return NextResponse.json({ error: "Apenas membros podem trocar senha aqui" }, { status: 403 });
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Senha atual e nova são obrigatórias" }, { status: 400 });
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: "Senha nova precisa ter ao menos 6 caracteres" }, { status: 400 });
  }

  const ru = await prisma.redeUser.findUnique({ where: { contactId: s.contactId } });
  if (!ru) {
    return NextResponse.json({ error: "Login não encontrado" }, { status: 404 });
  }

  const ok = await bcrypt.compare(currentPassword, ru.password);
  if (!ok) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 401 });
  }

  await prisma.redeUser.update({
    where: { id: ru.id },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });
  return NextResponse.json({ ok: true });
}
