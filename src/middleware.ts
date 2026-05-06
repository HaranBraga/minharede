import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth-edge";

// Caminhos públicos (não exigem login).
// O FORMULÁRIO DE CADASTRO PÚBLICO (?lider=, ?coord=, ?coord_form=) cai
// em "/" e é público — autenticação só é exigida em /dashboard, /admin
// e nas rotas de gestão.
const PUBLIC_PATHS = [
  "/",                       // landing/formulário público
  "/login",
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/public",             // qualquer rota pública /api/public/*
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + "/"));
}

function deny(req: NextRequest, kind: "auth" | "admin") {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/")) {
    const status = kind === "auth" ? 401 : 403;
    return NextResponse.json({ error: kind === "auth" ? "Não autenticado" : "Apenas admin" }, { status });
  }
  if (kind === "auth") {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL("/dashboard", req.url));
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return deny(req, "auth");
  const session = await verifySession(token);
  if (!session) return deny(req, "auth");

  // Rotas /admin e /api/admin* exigem isAdmin
  if ((path.startsWith("/admin") || path.startsWith("/api/admin")) && !session.isAdmin) {
    return deny(req, "admin");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
