import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Submit do formulário do apoiador (idêntico ao formelider antigo).
 *
 * Body: campos do form + nome_lider/nome_coordenador (hidden).
 *
 * Comportamento:
 *  1. Cria Contact (source="apoiador-form") no Postgres com parentId
 *     apontando pro líder (ou coord, se não houver líder).
 *  2. Dispara o webhook externo em paralelo (mantém a automação atual).
 *
 * Sempre retorna 200 mesmo se uma das duas etapas falhar — formulário
 * público não pode dar erro pro usuário final por questão de webhook.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`submit:${ip}`, { limit: 15, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto." }, { status: 429 });
    }

    const body = await req.json();
    const {
      nome, telefone, data_nascimento, genero,
      rua, bairro, cidade, zona,
      nome_lider, nome_coordenador,
    } = body;

    if (!nome?.trim()) {
      return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    }

    // Resolve parent (líder primeiro, coord como fallback)
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

    // Role apoiador
    const apoiadorRole = await prisma.personRole.findFirst({
      where: { OR: [{ key: "APOIADOR" }, { id: "role-apoiador" }] },
    }) || await prisma.personRole.findFirst({ orderBy: { level: "desc" } });
    if (!apoiadorRole) {
      return NextResponse.json({ error: "Cargo de apoiador não configurado" }, { status: 500 });
    }

    // Telefone normalizado (com 55)
    const phoneDigits = String(telefone ?? "").replace(/\D/g, "");
    const phoneWith55 = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

    // Data DD/MM/AAAA
    let nascimento: Date | null = null;
    if (data_nascimento) {
      const m = String(data_nascimento).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) nascimento = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
    }

    // Save no Postgres (não bloqueia o formulário se falhar — webhook continua)
    try {
      const existing = phoneWith55.length > 4
        ? await prisma.contact.findUnique({ where: { phone: phoneWith55 } })
        : null;

      if (existing) {
        await prisma.contact.update({
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
      } else {
        const slug = await uniqueSlug(String(nome));
        await prisma.contact.create({
          data: {
            name: String(nome).trim(),
            phone: phoneWith55 || `placeholder-${Date.now()}`,
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
      }
    } catch (err) {
      console.error("[submit] erro salvando Contact:", err);
    }

    // Webhook externo (mantém automação atual). Fire-and-forget.
    const webhookUrl = process.env.WEBHOOK_FORM_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(err => console.error("[submit] webhook:", err));
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[submit]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
