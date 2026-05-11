import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, rolesAllowedToCreate } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json([]);
  const all = await prisma.personRole.findMany({ orderBy: { level: "asc" } });
  const { minLevel } = await rolesAllowedToCreate(s);
  return NextResponse.json(all.filter(r => r.level >= minLevel));
}
