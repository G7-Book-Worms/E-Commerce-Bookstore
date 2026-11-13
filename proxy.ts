import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Next.js 16 "proxy" (formerly middleware). Runs before every matched request.
// 1. Adds a request ID + security headers to every response (Paul, SCRUM-67)
// 2. Guards pages that need a logged-in user or an admin (Marcelo, SCRUM-73/74/108)

const AUTH_PAGES = ["/user-login", "/user-register"];
const PROTECTED_PREFIXES = ["/account", "/cart", "/checkout", "/orders"];
const ADMIN_PREFIXES = ["/admin"];
const LOGIN_PAGE = "/user-login";

type Session = { id: number; email: string; role: string };

async function readSession(req: NextRequest): Promise<Session | null> {
  const token = req.cookies.get("auth_token")?.value;
  const secret = process.env.JWT_SECRET;
  // Fail closed: no secret configured means nobody is treated as logged in.
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as unknown as Session;
  } catch {
    return null; // invalid or expired token
  }
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function withHeaders(res: NextResponse, requestId: string) {
  res.headers.set("x-request-id", requestId);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export async function proxy(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const { pathname } = req.nextUrl;

  const isAuthPage = startsWithAny(pathname, AUTH_PAGES);
  const isProtected = startsWithAny(pathname, PROTECTED_PREFIXES);
  const isAdmin = startsWithAny(pathname, ADMIN_PREFIXES);

  if (isAuthPage || isProtected || isAdmin) {
    const session = await readSession(req);

    // Logged-in users don't need the login/register pages
    if (session && isAuthPage) {
      const home = session.role === "admin" ? "/admin" : "/";
      return withHeaders(NextResponse.redirect(new URL(home, req.url)), requestId);
    }

    // Not logged in -> send to login, then back here afterwards
    if (!session && (isProtected || isAdmin)) {
      const loginUrl = new URL(LOGIN_PAGE, req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return withHeaders(NextResponse.redirect(loginUrl), requestId);
    }

    // Logged in but not an admin
    if (session && isAdmin && session.role !== "admin") {
      return withHeaders(NextResponse.redirect(new URL("/", req.url)), requestId);
    }
  }

  const forwarded = new Headers(req.headers);
  forwarded.set("x-request-id", requestId);
  return withHeaders(NextResponse.next({ request: { headers: forwarded } }), requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
