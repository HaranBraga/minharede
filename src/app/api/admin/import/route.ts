import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uniqueSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Importação em massa da rede a partir de CSV.
 *
 * Body (JSON): { csv: string }
 *
 * Formato esperado (igual ao export do minha-rede atual):
 *   Nome,Link,Coordenador
 *   "Mario","https://link.azecode.cloud/?lider=mario","Joao"
 *   "Pedro","https://link.azecode.cloud/?lider=pedro",""
 *
 *   #COORDENADORES
 *   Nome,Link
 *   "Joao","https://link.azecode.cloud/?coord=joao"
 *
 * Estratégia:
 *  - Cria primeiro os COORDENADORES (level 1, sem parent)
 *  - Depois cria os LÍDERES (level 2) com parent = coordenador
 *  - Find-or-create por slug. Já existente é atualizado.
 *  - phone = placeholder se não houver (igual ao /create)
 */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "csv obrigatório" }, { status: 400 });
  }

  const csvClean = csv.replace(/^﻿/, "");
  const coordSectionIdx = csvClean.indexOf("#COORDENADORES");
  const leadersSection      = coordSectionIdx !== -1 ? csvClean.substring(0, coordSectionIdx) : csvClean;
  const coordinatorsSection = coordSectionIdx !== -1 ? csvClean.substring(coordSectionIdx)    : "";

  const parseLine = (line: string): string[] => {
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
  const coordLines = coordRawLines.slice(1); // skip header "Nome,Link"

  // PersonRoles necessários
  const [coordRole, liderRole] = await Promise.all([
    prisma.personRole.findFirst({ where: { OR: [{ key: "COORDENADOR" }, { id: "role-coordenador" }] } }),
    prisma.personRole.findFirst({ where: { OR: [{ key: "LIDER" },       { id: "role-lider" }] } }),
  ]);
  if (!coordRole || !liderRole) {
    return NextResponse.json({ error: "PersonRoles COORDENADOR/LIDER não cadastrados" }, { status: 500 });
  }

  let coordsCreated = 0, coordsSkipped = 0;
  let leadersCreated = 0, leadersSkipped = 0;
  const errors: string[] = [];

  // 1. Coordenadores
  const coordIdByName = new Map<string, string>();
  for (const line of coordLines) {
    const parts = parseLine(line);
    if (parts.length < 1 || !parts[0]) continue;
    const name = parts[0];
    try {
      const slug = await uniqueSlug(name);
      const found = await prisma.contact.findFirst({ where: { OR: [{ publicSlug: slug }, { name }] } });
      if (found) {
        coordIdByName.set(name.toLowerCase(), found.id);
        coordsSkipped++;
        continue;
      }
      const c = await prisma.contact.create({
        data: {
          name,
          phone: `import-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          publicSlug: slug,
          roleId: coordRole.id,
          source: "rede-import",
        },
      });
      coordIdByName.set(name.toLowerCase(), c.id);
      coordsCreated++;
    } catch (err: any) {
      errors.push(`Coord "${name}": ${err.message}`);
    }
  }

  // 2. Líderes (com parent = coordenador, se houver)
  for (const line of leaderLines) {
    const parts = parseLine(line);
    if (parts.length < 1 || !parts[0]) continue;
    const name = parts[0];
    const coordName = parts[2] || "";
    try {
      const slug = await uniqueSlug(name);
      const found = await prisma.contact.findFirst({ where: { OR: [{ publicSlug: slug }, { name }] } });
      if (found) { leadersSkipped++; continue; }

      let parentId: string | undefined;
      if (coordName) {
        parentId = coordIdByName.get(coordName.toLowerCase());
        if (!parentId) {
          // Coordenador não foi criado nessa importação — tenta achar no banco
          const ex = await prisma.contact.findFirst({
            where: {
              OR: [{ publicSlug: coordName.toLowerCase() }, { name: coordName }],
              roleId: coordRole.id,
            },
          });
          if (ex) parentId = ex.id;
        }
      }

      await prisma.contact.create({
        data: {
          name,
          phone: `import-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          publicSlug: slug,
          roleId: liderRole.id,
          parentId: parentId ?? null,
          source: "rede-import",
        },
      });
      leadersCreated++;
    } catch (err: any) {
      errors.push(`Líder "${name}": ${err.message}`);
    }
  }

  return NextResponse.json({
    coordsCreated, coordsSkipped,
    leadersCreated, leadersSkipped,
    errors,
  });
}
