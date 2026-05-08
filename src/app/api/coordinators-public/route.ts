import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCoordRoleId } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lista pública (só id + nome) de coordenadores. Usada no /login pra
 * mostrar a lista de "clique no seu nome pra entrar".
 *
 * Não retorna nada sensível — apenas nome pra reconhecer.
 */
export async function GET() {
  try {
    const coordRole = await getCoordRoleId();
    const rows = await prisma.contact.findMany({
      where: { roleId: coordRole },
      select: { id: true, name: true, publicSlug: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: rows });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
