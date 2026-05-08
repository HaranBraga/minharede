import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lista os contatos que podem ser parent de um cargo específico
 * (admin only). Usado no form "Adicionar usuário" do /admin pra
 * escolher coordenador pai ao criar líder, etc.
 *
 * Query: ?level=N (level do FILHO; retorna contatos de level menor)
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const childLevel = parseInt(sp.get("level") ?? "99");

  // parent precisa ser de level menor que o filho
  const contacts = await prisma.contact.findMany({
    where: {
      role: { level: { lt: childLevel } },
    },
    select: {
      id: true, name: true, publicSlug: true,
      role: { select: { label: true, color: true, bgColor: true, level: true } },
    },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(contacts);
}
