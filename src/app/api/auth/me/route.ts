import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ session: null });

  if (s.type === "admin") {
    return NextResponse.json({ session: { type: "admin" } });
  }

  // member: busca dados frescos do contato
  const contact = await prisma.contact.findUnique({
    where: { id: s.contactId },
    include: { role: true },
  });
  if (!contact) return NextResponse.json({ session: null });

  return NextResponse.json({
    session: {
      type: "member",
      contactId: contact.id,
      slug: contact.publicSlug ?? s.slug,
      name: contact.name,
      roleLevel: contact.role.level,
      roleLabel: contact.role.label,
      roleColor: contact.role.color,
      roleBgColor: contact.role.bgColor,
    },
  });
}
