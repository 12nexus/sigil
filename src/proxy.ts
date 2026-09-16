import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/services/auth/session";

/**
 * Authentication gate. Every page and API route requires a valid session
 * cookie, except the login page, the login/logout endpoints, and the
 * container healthcheck (GET /api/gemini/status, which only reports whether
 * a server key exists).
 *
 * Fails closed: if SIGIL_AUTH_USERNAME / SIGIL_AUTH_PASSWORD are unset, no
 * session can ever verify, so nothing past the login page is reachable.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(req)) return NextResponse.next();

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in to use SIGIL." } },
      { status: 401 },
    );
  }

  const login = new URL("/login", req.url);
  const next = pathname + req.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

function isPublic(req: NextRequest): boolean {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return true;
  if (pathname === "/api/gemini/status" && req.method === "GET") return true;
  return false;
}

export const config = {
  matcher: [
    // Everything except build assets and the brand files the login page shows.
    "/((?!_next/static|_next/image|favicon.svg|brand/).*)",
  ],
};
