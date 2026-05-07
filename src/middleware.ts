import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/",                        // landing pública (formulário do apoiador)
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/submit",
  "/api/leaders/by-name",     // resolve coord do líder no form público
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

  // /admin* só pra isAdmin OU Coord Grupo (level 0)
  const isCoordGrupo = session.roleLevel === 0;
  if ((path.startsWith("/admin") || path.startsWith("/api/admin")) && !session.isAdmin && !isCoordGrupo) {
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
