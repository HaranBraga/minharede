import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, placeholderPhone, uniqueSlug } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { csv } = await req.json().catch(() => ({}));
  if (!csv) return NextResponse.json({ error: "Nenhum dado CSV enviado." }, { status: 400 });

  const csvClean = csv.replace(/^﻿/, "");
  const coordSectionIdx = csvClean.indexOf("#COORDENADORES");
  const leadersSection      = coordSectionIdx !== -1 ? csvClean.substring(0, coordSectionIdx) : csvClean;
  const coordinatorsSection = coordSectionIdx !== -1 ? csvClean.substring(coordSectionIdx)    : "";

  const parseCsvLine = (line: string): string[] => {
    if (line.includes('","')) {
      const parts = line.split('","');
      parts[0] = parts[0].replace(/^"/, "");
      parts[parts.length - 1] = parts[parts.length - 1].replace(/"$/, "");
      return parts.map(s => s.trim());
    }
    return line.split(",").map(s => s.trim().replace(/^"/, "").replace(/"$/, ""));
  };

  const leaderLines = leadersSection.split(/\r?\n/).filter(l => l.trim().length > 0).slice(1);
  const coordRawLines = coordinatorsSection.split(/\r?\n/).filter(l => l.trim().length > 0 && !l.startsWith("#"));
  const coordLines = coordRawLines.slice(1);

  const [coordRole, liderRole] = await Promise.all([getCoordRoleId(), getLiderRoleId()]);

  let coordCount = 0;
  const coordIdByName = new Map<string, string>();
  for (const line of coordLines) {
    const parts = parseCsvLine(line);
    if (parts.length < 1 || !parts[0]) continue;
    const name = parts[0].toUpperCase();
    const found = await prisma.contact.findFirst({
      where: { roleId: coordRole, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (found) {
      coordIdByName.set(name.toLowerCase(), found.id);
      continue;
    }
    const slug = await uniqueSlug(name);
    const c = await prisma.contact.create({
      data: { name, phone: placeholderPhone(), publicSlug: slug, roleId: coordRole, source: "rede-import" },
      select: { id: true },
    });
    coordIdByName.set(name.toLowerCase(), c.id);
    coordCount++;
  }

  let leaderCount = 0;
  for (const line of leaderLines) {
    const parts = parseCsvLine(line);
    if (parts.length < 1 || !parts[0]) continue;
    const name = parts[0].toUpperCase();
    const coordName = (parts[2] || "").toUpperCase();
    const exists = await prisma.contact.findFirst({
      where: { roleId: liderRole, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (exists) continue;
    let parentId: string | null = null;
    if (coordName) {
      parentId = coordIdByName.get(coordName.toLowerCase()) ?? null;
      if (!parentId) {
        const p = await prisma.contact.findFirst({
          where: { roleId: coordRole, name: { equals: coordName, mode: "insensitive" } },
          select: { id: true },
        });
        parentId = p?.id ?? null;
        if (parentId) coordIdByName.set(coordName.toLowerCase(), parentId);
      }
    }
    const slug = await uniqueSlug(name);
    await prisma.contact.create({
      data: { name, phone: placeholderPhone(), publicSlug: slug, roleId: liderRole, parentId, source: "rede-import" },
    });
    leaderCount++;
  }

  return NextResponse.json({
    message: `Importação concluída. ${leaderCount} líderes e ${coordCount} coordenadores processados.`,
  });
}
