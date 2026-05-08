import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Submit do formulário do apoiador.
 *
 * Body: campos do form + nome_lider/nome_coordenador (do query param).
 *
 * 1. Cria/atualiza Contact (source="apoiador-form") no Postgres com parentId
 *    apontando pro líder (ou coord, se não houver líder).
 * 2. Dispara o webhook externo (WEBHOOK_FORM_URL) — aguarda resposta pra
 *    poder logar erro se houver, mas timeout curto (5s) pra não travar.
 *
 * Retorna { ok: true, savedToDb: bool, webhookSent: bool } pra debug.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`submit:${ip}`, { limit: 15, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    nome, telefone, data_nascimento, genero,
    rua, bairro, cidade, zona,
    nome_lider, nome_coordenador,
  } = body ?? {};

  if (!nome?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  // ── 1. Postgres ────────────────────────────────────────────────────
  let savedToDb = false;
  let savedContactId: string | null = null;
  try {
    let parentId: string | null = null;
    const slugLookup = (nome_lider || nome_coordenador || "").trim();
    if (slugLookup) {
      const parent = await prisma.contact.findFirst({
        where: {
          OR: [
            { publicSlug: slugLookup.toLowerCase() },
            { name: { equals: slugLookup, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      parentId = parent?.id ?? null;
    }

    const apoiadorRole = await prisma.personRole.findFirst({
      where: { OR: [{ key: "APOIADOR" }, { id: "role-apoiador" }] },
    }) || await prisma.personRole.findFirst({ orderBy: { level: "desc" } });
    if (!apoiadorRole) {
      console.error("[submit] Cargo de apoiador não configurado");
    } else {
      const phoneDigits = String(telefone ?? "").replace(/\D/g, "");
      const phoneWith55 = phoneDigits.startsWith("55") ? phoneDigits : (phoneDigits ? `55${phoneDigits}` : "");

      let nascimento: Date | null = null;
      if (data_nascimento) {
        const m = String(data_nascimento).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
          const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
          if (!isNaN(d.getTime())) nascimento = d;
        }
      }

      const existing = phoneWith55.length >= 12
        ? await prisma.contact.findUnique({ where: { phone: phoneWith55 } })
        : null;

      if (existing) {
        const updated = await prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: String(nome).trim(),
            ...(parentId && !existing.parentId && { parentId }),
            ...(genero  && { genero }),
            ...(rua     && { rua }),
            ...(bairro  && { bairro }),
            ...(cidade  && { cidade }),
            ...(zona    && { zona }),
            ...(nascimento && { dataNascimento: nascimento }),
          },
        });
        savedContactId = updated.id;
      } else {
        const slug = await uniqueSlug(String(nome));
        const created = await prisma.contact.create({
          data: {
            name: String(nome).trim(),
            phone: phoneWith55 || `placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            publicSlug: slug,
            roleId: apoiadorRole.id,
            parentId,
            source: "apoiador-form",
            genero: genero ?? null,
            rua: rua ?? null,
            bairro: bairro ?? null,
            cidade: cidade ?? null,
            zona: zona ?? null,
            dataNascimento: nascimento,
          },
        });
        savedContactId = created.id;
      }
      savedToDb = true;
    }
  } catch (err) {
    console.error("[submit] erro Postgres:", err);
  }

  // ── 2. Webhook externo ─────────────────────────────────────────────
  let webhookSent = false;
  const webhookUrl = process.env.WEBHOOK_FORM_URL;
  if (webhookUrl) {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      webhookSent = r.ok;
      if (!r.ok) {
        console.error(`[submit] webhook retornou ${r.status}: ${await r.text().catch(() => "")}`);
      }
    } catch (err) {
      console.error("[submit] erro webhook:", err);
    }
  } else {
    console.warn("[submit] WEBHOOK_FORM_URL não configurada");
  }

  // Sucesso visual pro usuário se PELO MENOS UM dos dois funcionou
  if (!savedToDb && !webhookSent) {
    return NextResponse.json(
      { error: "Não foi possível registrar o cadastro. Tente novamente em alguns instantes." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, savedToDb, webhookSent, contactId: savedContactId });
}
