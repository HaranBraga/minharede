import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Submit do formulário do apoiador.
 *
 * Cria/atualiza Contact (source="apoiador-form") no Postgres com parentId
 * apontando pro líder (ou coord, se não houver líder).
 *
 * Body: campos do form + nome_lider/nome_coordenador (do query param).
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

  try {
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
      console.error("[submit] Cargo de apoiador não configurado");
      return NextResponse.json({ error: "Sistema não configurado. Contate o admin." }, { status: 500 });
    }

    // Telefone normalizado (com 55)
    const phoneDigits = String(telefone ?? "").replace(/\D/g, "");
    const phoneWith55 = phoneDigits.startsWith("55") ? phoneDigits : (phoneDigits ? `55${phoneDigits}` : "");

    // Data DD/MM/AAAA → Date
    let nascimento: Date | null = null;
    if (data_nascimento) {
      const m = String(data_nascimento).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
        if (!isNaN(d.getTime())) nascimento = d;
      }
    }

    // Dedupe por phone
    const existing = phoneWith55.length >= 12
      ? await prisma.contact.findUnique({ where: { phone: phoneWith55 } })
      : null;

    let contactId: string;
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
      contactId = updated.id;
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
      contactId = created.id;
    }

    return NextResponse.json({ ok: true, contactId });
  } catch (err: any) {
    console.error("[submit]", err);
    return NextResponse.json({ error: "Erro ao registrar cadastro. Tente novamente." }, { status: 500 });
  }
}
