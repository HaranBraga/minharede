import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lista cargos disponíveis (PersonRole). Filtra os que o user pode criar:
 * só níveis abaixo do dele (admin vê todos).
 */
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const all = await prisma.personRole.findMany({ orderBy: { level: "asc" } });
  if (me.isAdmin) return NextResponse.json(all);

  const minLevel = (me.roleLevel ?? -1) + 1;
  const allowed = all.filter(r => r.level >= minLevel);
  return NextResponse.json(allowed);
}
