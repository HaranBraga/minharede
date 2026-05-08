import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api/auth/admin/login",
  "/api/auth/login-by-name",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/submit",
  "/api/leaders/by-name",
  "/api/coordinators-public",  // lista pública (só nomes) pra mostrar no /login
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (isPublic(path)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("from", path);
    return NextResponse.redirect(url);
  }

  // /admin* e /api/admin* só admin
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
