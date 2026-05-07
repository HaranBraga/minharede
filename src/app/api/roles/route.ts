import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, rolesAllowedToCreate } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lista roles que o user pode criar (apenas níveis abaixo do dele).
 * Admin/Coord Grupo: todos. Coord: Líder + Apoiador. Líder: Apoiador.
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json([]);

  const all = await prisma.personRole.findMany({ orderBy: { level: "asc" } });
  const { minLevel } = rolesAllowedToCreate(me);
  return NextResponse.json(all.filter(r => r.level >= minLevel));
}
