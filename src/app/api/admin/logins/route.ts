import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lista logins do minha-rede (admin only).
 * Query params:
 *   - type:    "admin" | "member" (opcional)
 *   - search:  filtro por actorName
 *   - page, limit (default page=1, limit=50, máx 200)
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const type   = sp.get("type") ?? undefined;
  const search = sp.get("search")?.trim();
  const page   = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const limit  = Math.min(200, Math.max(1, parseInt(sp.get("limit") ?? "50")));

  const where: any = {};
  if (type === "admin" || type === "member") where.type = type;
  if (search) where.actorName = { contains: search, mode: "insensitive" };

  const [logs, total] = await Promise.all([
    prisma.redeLoginLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contact: {
          select: { id: true, name: true, role: { select: { label: true, color: true, bgColor: true } } },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.redeLoginLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
