import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCoordRoleId, getLiderRoleId, uniqueSlug, uniqueUsername } from "@/lib/rede";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 min

/**
 * Importação em massa da planilha 'Pessoas - teste.xlsx'.
 * Admin only.
 *
 * Body esperado:
 * {
 *   coords:     [{ name, username }],
 *   liders:     [{ name, username, coordName? }],
 *   apoiadores: [{
 *     name, phone?, email?, dataNascimento?, genero?, rua?, bairro?, cidade?, zona?,
 *     liderName?, coordName?,
 *     end?, ip?, lgpd?, source?
 *   }],
 *   defaultPassword?: string (default "123456")
 * }
 *
 * Estratégia:
 *  1. Cria todos os coords (Contact + RedeUser). Pula se já existe pelo nome.
 *  2. Cria todos os líderes vinculados ao coord pelo nome. Se o "líder"
 *     já existe como coord, pula (coord vira líder dos próprios apoiadores).
 *  3. Cria os apoiadores resolvendo parentId: 1º tenta líder, 2º coord.
 *  4. Telefone do apoiador: se houver, usa 55+digits; se já existir no banco
 *     (pessoas que compartilham número), salva como placeholder único e
 *     guarda o telefone real em customFields.originalPhone.
 *  5. End/IP/LGPD vão em customFields.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.apoiadores)) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const defaultPassword: string = body.defaultPassword || "123456";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const coords:     Array<any> = body.coords ?? [];
  const liders:     Array<any> = body.liders ?? [];
  const apoiadores: Array<any> = body.apoiadores ?? [];

  const [coordRoleId, liderRoleId] = await Promise.all([
    getCoordRoleId(),
    getLiderRoleId(),
  ]);
  const apoiadorRole = await prisma.personRole.findFirst({
    where: { OR: [{ key: "APOIADOR" }, { id: "role-apoiador" }] },
    select: { id: true },
  });
  const apoiadorRoleId = apoiadorRole?.id;
  if (!apoiadorRoleId) {
    return NextResponse.json({ error: "Cargo Apoiador não configurado" }, { status: 500 });
  }

  function normName(s: string): string {
    return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().trim().replace(/\s+/g, " ");
  }
  function normalizePhone(v: any): string | null {
    if (v === null || v === undefined) return null;
    const d = String(v).replace(/\D/g, "");
    if (!d) return null;
    return d.startsWith("55") ? d : `55${d}`;
  }
  function parseDate(v: any): Date | null {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  /** Coerce qualquer valor pra string trim, ou null se vazio. */
  function str(v: any): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s || null;
  }

  const report = {
    coords_criados: 0, coords_existiam: 0,
    liders_criados: 0, liders_existiam: 0, liders_como_coord: 0,
    apoiadores_criados: 0, apoiadores_existiam: 0,
    sem_parent: 0,
    com_phone_placeholder: 0,
    errors: [] as string[],
  };

  // Cache: norm_name → contactId. Inclui já-existentes no banco também.
  const knownByName = new Map<string, string>();

  // Pré-carrega Contacts existentes pra usar como cache
  const existingAll = await prisma.contact.findMany({
    select: { id: true, name: true, roleId: true },
  });
  for (const c of existingAll) knownByName.set(normName(c.name), c.id);

  // ── 1. COORDENADORES ─────────────────────────────────────────────
  for (const c of coords) {
    try {
      const nameTrim = String(c.name || "").trim();
      const nNorm = normName(nameTrim);
      if (!nameTrim) continue;
      if (knownByName.has(nNorm)) {
        report.coords_existiam++;
        continue;
      }
      const slug = await uniqueSlug(nameTrim);
      const username = c.username?.trim().toLowerCase() || await uniqueUsername(nameTrim);
      const usernameTaken = await prisma.redeUser.findUnique({ where: { username } });
      const finalUsername = usernameTaken ? await uniqueUsername(nameTrim + " " + Date.now()) : username;

      const created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: {
            name: nameTrim,
            phone: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            publicSlug: slug,
            roleId: coordRoleId,
            source: "import-planilha",
          },
          select: { id: true },
        });
        await tx.redeUser.create({
          data: { contactId: contact.id, username: finalUsername, password: passwordHash },
        });
        return contact;
      });
      knownByName.set(nNorm, created.id);
      report.coords_criados++;
    } catch (err: any) {
      report.errors.push(`coord "${c.name}": ${err.message}`);
    }
  }

  // ── 2. LÍDERES ───────────────────────────────────────────────────
  for (const l of liders) {
    try {
      const nameTrim = String(l.name || "").trim();
      const nNorm = normName(nameTrim);
      if (!nameTrim) continue;

      const existingId = knownByName.get(nNorm);
      if (existingId) {
        // Já existe (pode ser o próprio coord) — não cria de novo
        const existingContact = await prisma.contact.findUnique({
          where: { id: existingId },
          select: { roleId: true },
        });
        if (existingContact?.roleId === coordRoleId) report.liders_como_coord++;
        else report.liders_existiam++;
        continue;
      }

      const parentId = l.coordName?.trim()
        ? (knownByName.get(normName(l.coordName)) ?? null)
        : null;

      const slug = await uniqueSlug(nameTrim);
      const username = l.username?.trim().toLowerCase() || await uniqueUsername(nameTrim);
      const usernameTaken = await prisma.redeUser.findUnique({ where: { username } });
      const finalUsername = usernameTaken ? await uniqueUsername(nameTrim + " " + Date.now()) : username;

      const created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: {
            name: nameTrim,
            phone: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            publicSlug: slug,
            roleId: liderRoleId,
            parentId,
            source: "import-planilha",
          },
          select: { id: true },
        });
        await tx.redeUser.create({
          data: { contactId: contact.id, username: finalUsername, password: passwordHash },
        });
        return contact;
      });
      knownByName.set(nNorm, created.id);
      report.liders_criados++;
    } catch (err: any) {
      report.errors.push(`líder "${l.name}": ${err.message}`);
    }
  }

  // ── 3. APOIADORES ────────────────────────────────────────────────
  for (const a of apoiadores) {
    try {
      const nameTrim = String(a.name || "").trim();
      const nNorm = normName(nameTrim);
      if (!nameTrim) continue;

      if (knownByName.has(nNorm)) {
        report.apoiadores_existiam++;
        continue;
      }

      // Parent: prioriza líder, fallback coord
      let parentId: string | null = null;
      if (a.liderName?.trim()) parentId = knownByName.get(normName(a.liderName)) ?? null;
      if (!parentId && a.coordName?.trim()) parentId = knownByName.get(normName(a.coordName)) ?? null;
      if (!parentId) report.sem_parent++;

      // Phone: se já existe, vira placeholder (várias pessoas podem ter mesmo número)
      const phoneClean = normalizePhone(a.phone);
      let finalPhone: string;
      let originalPhone: string | null = null;
      if (phoneClean) {
        const taken = await prisma.contact.findUnique({ where: { phone: phoneClean } });
        if (taken) {
          finalPhone = `placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          originalPhone = phoneClean;
          report.com_phone_placeholder++;
        } else {
          finalPhone = phoneClean;
        }
      } else {
        finalPhone = `placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }

      const slug = await uniqueSlug(nameTrim);

      const customFields: Record<string, any> = {};
      if (a.end !== undefined && a.end !== null && a.end !== "") customFields.end = String(a.end);
      if (a.ip !== undefined && a.ip !== null && a.ip !== "")    customFields.ip  = String(a.ip);
      if (a.lgpd !== undefined && a.lgpd !== null && a.lgpd !== "") customFields.lgpd = String(a.lgpd);
      if (originalPhone) customFields.originalPhone = originalPhone;
      customFields.originalLider = a.liderName ?? null;
      customFields.originalCoord = a.coordName ?? null;
      customFields.sourceSheet   = a.source ?? null;

      await prisma.contact.create({
        data: {
          name: nameTrim,
          phone: finalPhone,
          publicSlug: slug,
          roleId: apoiadorRoleId,
          parentId,
          source: "import-planilha",
          email:          str(a.email),
          dataNascimento: parseDate(a.dataNascimento),
          genero:         str(a.genero),
          rua:            str(a.rua),
          bairro:         str(a.bairro),
          cidade:         str(a.cidade),
          zona:           str(a.zona),
          customFields,
        },
      });
      knownByName.set(nNorm, "ok"); // marca como processado (não precisamos do id)
      report.apoiadores_criados++;
    } catch (err: any) {
      report.errors.push(`apoiador "${a.name}": ${err.message}`);
    }
  }

  return NextResponse.json(report);
}
