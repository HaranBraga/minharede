import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Submit do formulário público do apoiador.
 *
 * Body: {
 *   nome, telefone, dataNascimento (DD/MM/AAAA ou ISO), genero,
 *   rua, bairro, cidade, zona,
 *   liderSlug?,        // slug do líder (vindo do ?lider=)
 *   coordSlug?,        // slug do coordenador (vindo do ?coord_form=) — usado quando não tem líder
 * }
 *
 * Cria Contact com source="apoiador-form" + parentId apontando pro
 * líder (preferência) ou coord. Em paralelo dispara o webhook externo
 * (mantém compat com automação atual).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`submit:${ip}`, { limit: 10, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
    }

    const body = await req.json();
    const { nome, telefone, dataNascimento, genero, rua, bairro, cidade, zona, liderSlug, coordSlug } = body;
    if (!nome?.trim() || !telefone?.trim()) {
      return NextResponse.json({ error: "Nome e telefone são obrigatórios" }, { status: 400 });
    }

    // Resolve parent (líder tem prioridade sobre coord)
    let parentContact: { id: string; name: string } | null = null;
    const slugLookup = (liderSlug || coordSlug || "").trim();
    if (slugLookup) {
      const found = await prisma.contact.findFirst({
        where: {
          OR: [
            { publicSlug: slugLookup.toLowerCase() },
            { name: { equals: slugLookup, mode: "insensitive" } },
            { name: { equals: slugLookup.replace(/-/g, " "), mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true },
      });
      parentContact = found;
    }

    // Role: apoiador é o nível mais baixo
    const apoiadorRole = await prisma.personRole.findFirst({
      where: { OR: [{ key: "APOIADOR" }, { id: "role-apoiador" }] },
    }) || await prisma.personRole.findFirst({ orderBy: { level: "desc" } });
    if (!apoiadorRole) {
      return NextResponse.json({ error: "Cargo de apoiador não configurado" }, { status: 500 });
    }

    // Telefone: normaliza (só dígitos) + adiciona 55 se necessário
    const phoneDigits = String(telefone).replace(/\D/g, "");
    const phoneWith55 = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;

    // Data de nascimento: aceita DD/MM/AAAA ou ISO
    let nascimento: Date | null = null;
    if (dataNascimento) {
      const s = String(dataNascimento).trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) nascimento = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
      else {
        const d = new Date(s);
        if (!isNaN(d.getTime())) nascimento = d;
      }
    }

    // Dedupe por phone (não cria 2 vezes)
    let contact = await prisma.contact.findUnique({ where: { phone: phoneWith55 } });
    if (contact) {
      // Atualiza com os dados novos se vier preenchido
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          name: nome.trim(),
          ...(parentContact && !contact.parentId && { parentId: parentContact.id }),
          ...(genero  && { genero }),
          ...(rua     && { rua }),
          ...(bairro  && { bairro }),
          ...(cidade  && { cidade }),
          ...(zona    && { zona }),
          ...(nascimento && { dataNascimento: nascimento }),
        },
      });
    } else {
      const slug = await uniqueSlug(nome);
      contact = await prisma.contact.create({
        data: {
          name: nome.trim(),
          phone: phoneWith55,
          publicSlug: slug,
          roleId: apoiadorRole.id,
          parentId: parentContact?.id ?? null,
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

    // Dispara webhook externo em paralelo (não bloqueia resposta).
    const webhookUrl = process.env.WEBHOOK_FORM_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          telefone: phoneDigits,
          data_nascimento: dataNascimento ?? null,
          genero,
          rua, bairro, cidade, zona,
          nome_lider: liderSlug || null,
          nome_coordenador: coordSlug || (parentContact?.name ?? null),
        }),
      }).catch(err => console.error("[webhook]", err));
    }

    return NextResponse.json({
      ok: true,
      contact: { id: contact.id, name: contact.name },
      parent: parentContact,
    });
  } catch (err: any) {
    console.error("[submit]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
