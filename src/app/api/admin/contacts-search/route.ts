import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Busca Contacts pra associar a User no admin (admin/coord grupo only). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!me.isAdmin && me.roleLevel !== 0) {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const where: any = q ? { name: { contains: q, mode: "insensitive" } } : {};
  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true, name: true, publicSlug: true,
      role: { select: { label: true, color: true, bgColor: true, level: true } },
      user: { select: { id: true, username: true } },
    },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" } ],
    take: 30,
  });
  return NextResponse.json(contacts);
}
