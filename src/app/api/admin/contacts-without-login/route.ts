import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/contacts-without-login
 *
 * Lista contatos que ainda NÃO têm RedeUser (login) vinculado.
 * Usado pra criar login pra alguém já cadastrado.
 *
 * Filtra naturalmente por cargos que podem ter login (level <= 2 —
 * coord-grupo, coord e líder). Apoiador (level 3) não loga.
 *
 * Query opcional: ?level=0|1|2 pra filtrar um cargo específico.
 *                 ?q=busca pra filtrar por nome.
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const levelParam = searchParams.get("level");
  const q = (searchParams.get("q") ?? "").trim();

  const where: any = {
    redeUser: null,
    role: { level: { lte: 2 } },
  };
  if (levelParam !== null && levelParam !== "") {
    const lv = Number(levelParam);
    if (!isNaN(lv)) where.role = { level: lv };
  }
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true, name: true, publicSlug: true,
      cidade: true,
      role: { select: { id: true, key: true, label: true, level: true, color: true, bgColor: true } },
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
    take: 200,
  });

  return NextResponse.json(contacts);
}
