import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/admin/login",
  "/api/auth/admin/login",
  "/api/auth/login-by-name",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/submit",
  "/api/leaders/by-name",
  "/api/coordinators-public",
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  // Não autenticado
  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    // /admin* → /admin/login (URL separada)
    // demais → /login
    const loginPath = path.startsWith("/admin") ? "/admin/login" : "/login";
    const url = new URL(loginPath, req.url);
    if (!path.startsWith("/admin")) url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  // Autenticado mas não é admin tentando acessar /admin*
  if ((path.startsWith("/admin") || path.startsWith("/api/admin")) && session.type !== "admin") {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
