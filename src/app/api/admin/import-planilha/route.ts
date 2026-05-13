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
 *   coordGrupos: [{ name, username?, phone?, customFields? }],
 *   coords:      [{ name, username?, phone?, coordGrupoName?, customFields? }],
 *   liders:      [{ name, username?, phone?, coordName?, customFields? }],
 *   apoiadores:  [{
 *     name, phone?, email?, dataNascimento?, genero?, rua?, bairro?, cidade?, zona?,
 *     liderName?, coordName?,
 *     end?, ip?, lgpd?, source?, customFields?
 *   }],
 *   defaultPassword?: string (default "123456")
 * }
 *
 * Estratégia:
 *  1. Cria coordGrupos (role level 0). Pula se já existe.
 *  2. Cria coords (role level 1), vinculados a coordGrupo pelo nome se houver.
 *  3. Cria líderes vinculados ao coord pelo nome. Se o "líder" já existe
 *     como coord, pula (coord vira líder dos próprios apoiadores).
 *  4. Cria apoiadores resolvendo parentId: 1º tenta líder, 2º coord.
 *  5. Telefone: se vier real e não duplicar, usa 55+digits.
 *     Se duplicar, vira placeholder e guarda o real em customFields.originalPhone.
 *     Se vier vazio, vira placeholder import-...
 *  6. customFields fornecidos por linha são MESCLADOS no Contact.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (s?.type !== "admin") {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const defaultPassword: string = body.defaultPassword || "123456";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const coordGrupos: Array<any> = body.coordGrupos ?? [];
  const coords:      Array<any> = body.coords ?? [];
  const liders:      Array<any> = body.liders ?? [];
  const apoiadores:  Array<any> = body.apoiadores ?? [];

  const [coordRoleId, liderRoleId] = await Promise.all([
    getCoordRoleId(),
    getLiderRoleId(),
  ]);
  const coordGrupoRole = await prisma.personRole.findFirst({
    where: { OR: [{ key: "COORDENADOR_GRUPO" }, { id: "role-coordenador-grupo" }] },
    select: { id: true },
  });
  const coordGrupoRoleId = coordGrupoRole?.id;
  const apoiadorRole = await prisma.personRole.findFirst({
    where: { OR: [{ key: "APOIADOR" }, { id: "role-apoiador" }] },
    select: { id: true },
  });
  const apoiadorRoleId = apoiadorRole?.id;
  if (!apoiadorRoleId) {
    return NextResponse.json({ error: "Cargo Apoiador não configurado" }, { status: 500 });
  }
  if (coordGrupos.length > 0 && !coordGrupoRoleId) {
    return NextResponse.json({ error: "Cargo Coord. de Grupo não configurado" }, { status: 500 });
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
    coord_grupos_criados: 0, coord_grupos_existiam: 0,
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

  /**
   * Resolve telefone: se phone vier não-vazio e não estiver tomado,
   * usa formato 55+digits; se estiver tomado, devolve placeholder + originalPhone.
   * Se vier vazio, devolve placeholder.
   */
  async function resolvePhone(rawPhone: any, txOrPrisma: any = prisma): Promise<{ phone: string; originalPhone: string | null }> {
    const clean = normalizePhone(rawPhone);
    if (!clean) {
      return {
        phone: `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        originalPhone: null,
      };
    }
    const taken = await txOrPrisma.contact.findUnique({ where: { phone: clean } });
    if (taken) {
      report.com_phone_placeholder++;
      return {
        phone: `placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        originalPhone: clean,
      };
    }
    return { phone: clean, originalPhone: null };
  }

  function mergeCustom(extra: any, base: Record<string, any>): Record<string, any> {
    if (extra && typeof extra === "object" && !Array.isArray(extra)) {
      return { ...extra, ...base };
    }
    return base;
  }

  // ── 0. COORD GRUPOS ───────────────────────────────────────────────
  for (const cg of coordGrupos) {
    try {
      const nameTrim = String(cg.name || "").trim();
      const nNorm = normName(nameTrim);
      if (!nameTrim) continue;
      if (knownByName.has(nNorm)) { report.coord_grupos_existiam++; continue; }

      const slug = await uniqueSlug(nameTrim);
      const username = cg.username?.trim().toLowerCase() || await uniqueUsername(nameTrim);
      const usernameTaken = await prisma.redeUser.findUnique({ where: { username } });
      const finalUsername = usernameTaken ? await uniqueUsername(nameTrim + " " + Date.now()) : username;

      const { phone, originalPhone } = await resolvePhone(cg.phone);
      const customFields = mergeCustom(cg.customFields, originalPhone ? { originalPhone } : {});

      const created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: {
            name: nameTrim,
            phone,
            publicSlug: slug,
            roleId: coordGrupoRoleId!,
            source: "import-planilha",
            customFields: Object.keys(customFields).length ? customFields : undefined,
          },
          select: { id: true },
        });
        await tx.redeUser.create({
          data: { contactId: contact.id, username: finalUsername, password: passwordHash },
        });
        return contact;
      });
      knownByName.set(nNorm, created.id);
      report.coord_grupos_criados++;
    } catch (err: any) {
      report.errors.push(`coord-grupo "${cg.name}": ${err.message}`);
    }
  }

  // ── 1. COORDENADORES ─────────────────────────────────────────────
  for (const c of coords) {
    try {
      const nameTrim = String(c.name || "").trim();
      const nNorm = normName(nameTrim);
      if (!nameTrim) continue;
      if (knownByName.has(nNorm)) { report.coords_existiam++; continue; }

      const parentId = c.coordGrupoName?.trim()
        ? (knownByName.get(normName(c.coordGrupoName)) ?? null)
        : null;

      const slug = await uniqueSlug(nameTrim);
      const username = c.username?.trim().toLowerCase() || await uniqueUsername(nameTrim);
      const usernameTaken = await prisma.redeUser.findUnique({ where: { username } });
      const finalUsername = usernameTaken ? await uniqueUsername(nameTrim + " " + Date.now()) : username;

      const { phone, originalPhone } = await resolvePhone(c.phone);
      const customFields = mergeCustom(c.customFields, originalPhone ? { originalPhone } : {});

      const created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: {
            name: nameTrim,
            phone,
            publicSlug: slug,
            roleId: coordRoleId,
            parentId,
            source: "import-planilha",
            customFields: Object.keys(customFields).length ? customFields : undefined,
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

      const { phone, originalPhone } = await resolvePhone(l.phone);
      const customFields = mergeCustom(l.customFields, originalPhone ? { originalPhone } : {});

      const created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: {
            name: nameTrim,
            phone,
            publicSlug: slug,
            roleId: liderRoleId,
            parentId,
            source: "import-planilha",
            dataNascimento: parseDate(l.dataNascimento),
            rua:    str(l.rua),
            bairro: str(l.bairro),
            cidade: str(l.cidade),
            zona:   str(l.zona),
            customFields: Object.keys(customFields).length ? customFields : undefined,
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

      const baseCustom: Record<string, any> = {};
      if (a.ip !== undefined && a.ip !== null && a.ip !== "")    baseCustom.ip  = String(a.ip);
      if (a.lgpd !== undefined && a.lgpd !== null && a.lgpd !== "") baseCustom.lgpd = String(a.lgpd);
      if (originalPhone) baseCustom.originalPhone = originalPhone;
      baseCustom.originalLider = a.liderName ?? null;
      baseCustom.originalCoord = a.coordName ?? null;
      baseCustom.sourceSheet   = a.source ?? null;
      const customFields = mergeCustom(a.customFields, baseCustom);

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
          endRef:         str(a.end),
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
