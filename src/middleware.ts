import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth-edge";

/**
 * - "/" e "/api/submit" são públicos (formulário do apoiador, etc).
 * - "/api/admin/*" exige sessão type=admin.
 * - "/api/coord/*" pode ser admin OU coord.
 * - "/api/leaders" e "/api/coordinators" liberados pra admin OU coord
 *   (cada handler aplica o filtro/escopo apropriado).
 */
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Páginas: tudo público (a SPA controla qual UI mostrar)
  if (!path.startsWith("/api/")) return NextResponse.next();

  // Rotas API públicas
  if (path === "/api/submit") return NextResponse.next();
  if (path === "/api/admin/login")  return NextResponse.next();
  if (path === "/api/admin/logout") return NextResponse.next();
  if (path === "/api/coord/login")  return NextResponse.next();
  if (path === "/api/coord/logout") return NextResponse.next();
  // Endpoints de leitura usados pelo login do coord (lista de coords pra clicar)
  if (path === "/api/coordinators" && req.method === "GET") return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // /api/admin/* exige admin
  if (path.startsWith("/api/admin/") && session.type !== "admin") {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
