import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Identifica todos os telefones que estão em uso por MAIS DE UMA pessoa
 * (somando phone direto e customFields.originalPhone) e LIMPA o telefone
 * de todos os contatos desses grupos — pra serem recadastrados depois.
 *
 * O telefone original fica preservado em customFields.clearedPhone pra
 * referência no recadastro.
 *
 * Body opcional: { dryRun: true } — só lista, não altera.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") return NextResponse.json({ error: "Apenas admin" }, { status: 403 });

  const { dryRun = false } = await req.json().catch(() => ({}));

  // 1. Contacts com phone REAL (não placeholder)
  const allContacts = await prisma.contact.findMany({
    select: { id: true, name: true, phone: true, customFields: true },
  });

  function normalize(p: string | null | undefined): string | null {
    if (!p) return null;
    const s = String(p).trim();
    if (!s || s.startsWith("placeholder") || s.startsWith("import-") || s.startsWith("temp-")) return null;
    const d = s.replace(/\D/g, "");
    if (!d) return null;
    return d.startsWith("55") ? d : `55${d}`;
  }

  // Mapa: phone normalizado → lista de contatos que usam (direto OU em customFields.originalPhone)
  type Owner = { id: string; name: string; via: "phone" | "originalPhone" };
  const groups = new Map<string, Owner[]>();

  for (const c of allContacts) {
    const cf = (c.customFields as any) || {};

    // phone direto
    const realPhone = normalize(c.phone);
    if (realPhone) {
      const arr = groups.get(realPhone) ?? [];
      arr.push({ id: c.id, name: c.name, via: "phone" });
      groups.set(realPhone, arr);
    }

    // customFields.originalPhone
    const origPhone = normalize(cf.originalPhone);
    if (origPhone) {
      const arr = groups.get(origPhone) ?? [];
      arr.push({ id: c.id, name: c.name, via: "originalPhone" });
      groups.set(origPhone, arr);
    }
  }

  // 2. Filtra grupos com > 1
  const shared: { phone: string; members: Owner[] }[] = [];
  for (const [phone, members] of groups) {
    if (members.length > 1) shared.push({ phone, members });
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalGruposCompartilhados: shared.length,
      totalContatosAfetados: shared.reduce((s, g) => s + g.members.length, 0),
      grupos: shared.slice(0, 30).map(g => ({
        phone: g.phone,
        membros: g.members.map(m => m.name),
      })),
      hint: shared.length > 30 ? `Mostrando 30 de ${shared.length} grupos` : null,
    });
  }

  // 3. Limpa os telefones dos contatos afetados
  let cleared = 0;
  const errors: string[] = [];
  const affectedIds = new Set<string>();
  for (const g of shared) {
    for (const m of g.members) affectedIds.add(m.id);
  }

  for (const id of affectedIds) {
    try {
      const c = await prisma.contact.findUnique({
        where: { id },
        select: { phone: true, customFields: true },
      });
      if (!c) continue;
      const cf = ((c.customFields as any) || {}) as Record<string, any>;
      const realPhone = normalize(c.phone);
      if (realPhone) cf.clearedPhone = realPhone;
      else if (cf.originalPhone) cf.clearedPhone = cf.originalPhone;
      delete cf.originalPhone;

      await prisma.contact.update({
        where: { id },
        data: {
          phone: `cleared-${id}`,
          customFields: cf,
        },
      });
      cleared++;
    } catch (err: any) {
      errors.push(`${id}: ${err.message}`);
    }
  }

  return NextResponse.json({
    dryRun: false,
    totalGruposCompartilhados: shared.length,
    totalContatosLimpos: cleared,
    errors,
  });
}
