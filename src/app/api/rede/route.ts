import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, descendantContactIds } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const allowed = await descendantContactIds(s);
  const where: any = allowed === "all" ? {} : { id: { in: allowed } };

  const contacts = await prisma.contact.findMany({
    where,
    select: {
      id: true, name: true, phone: true, publicSlug: true, parentId: true,
      cidade: true, bairro: true, zona: true, createdAt: true,
      role: { select: { id: true, key: true, label: true, color: true, bgColor: true, level: true } },
      _count: { select: { children: true } },
    },
    orderBy: [{ role: { level: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json({
    rootContactId: s.type === "admin" ? null : s.contactId,
    rootName: s.type === "admin" ? null : s.name,
    rootRoleLevel: s.type === "admin" ? null : s.roleLevel,
    iAmAdmin: s.type === "admin",
    contacts,
  });
}
