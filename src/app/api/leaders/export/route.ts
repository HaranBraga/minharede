import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, publicLink } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "")
    ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/**
 * Export CSV no formato do formelider antigo:
 *   Nome,Link,Coordenador
 *   "Mario","https://link.azecode.cloud/?lider=mario","João"
 *   ...
 *
 *   #COORDENADORES
 *   Nome,Link
 *   "João","https://link.azecode.cloud/?coord=joao"
 *
 * Inclui BOM UTF-8 pra Excel abrir certo.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (session?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const [liderRole, coordRole] = await Promise.all([getLiderRoleId(), getCoordRoleId()]);
  const [lideres, coords] = await Promise.all([
    prisma.contact.findMany({
      where: { roleId: liderRole },
      select: { name: true, publicSlug: true, parent: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contact.findMany({
      where: { roleId: coordRole },
      select: { name: true, publicSlug: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const base = baseUrl(req);
  let csv = "Nome,Link,Coordenador\n";
  for (const l of lideres) {
    const name  = l.name.replace(/"/g, '""');
    const link  = publicLink(base, "lider", l.publicSlug ?? l.name).replace(/"/g, '""');
    const coord = (l.parent?.name ?? "").replace(/"/g, '""');
    csv += `"${name}","${link}","${coord}"\n`;
  }
  csv += "\n#COORDENADORES\nNome,Link\n";
  for (const c of coords) {
    const name = c.name.replace(/"/g, '""');
    const link = publicLink(base, "coord", c.publicSlug ?? c.name).replace(/"/g, '""');
    csv += `"${name}","${link}"\n`;
  }

  return new NextResponse("﻿" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="formelider.csv"',
    },
  });
}
