import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

/**
 * Registra um login (admin ou member) na RedeLoginLog.
 * Falha silenciosamente — log não pode quebrar o login.
 */
export async function logRedeLogin(input: {
  type: "admin" | "member";
  actorName: string;
  contactId?: string | null;
  req?: NextRequest | Request;
}): Promise<void> {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    if (input.req) {
      const xff = input.req.headers.get("x-forwarded-for");
      ip = xff ? xff.split(",")[0].trim() : input.req.headers.get("x-real-ip");
      ua = input.req.headers.get("user-agent");
    }
    await prisma.redeLoginLog.create({
      data: {
        type: input.type,
        contactId: input.contactId ?? null,
        actorName: input.actorName,
        ipAddress: ip,
        userAgent: ua,
      },
    });
  } catch (err) {
    console.error("[redeLog]", err);
  }
}
