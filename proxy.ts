import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { requiresCustomerSession } from "./lib/route-access";

// Next.js 16 "proxy" (formerly middleware). Runs before every matched request.
// 1. Adds a request ID to every response (security headers are set in next.config.ts)
// 2. Blocks cross-site POST/PUT/PATCH/DELETE requests to the API (CSRF, SCRUM-213)
// 3. Guards pages that need a signed-in customer or staff member (SCRUM-73/74/108/206).
//    This is only the first gate: every API route and staff page checks the session again
//    against the database (deactivated accounts, signed-out tokens, role permissions).

const AUTH_PAGES = ["/user-login", "/user-register"];
const STAFF_PREFIXES = ["/admin"];
const LOGIN_PAGE = "/user-login";
const STAFF_LOGIN_PAGE = "/staff-login";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type Session = { id: number; email: string; role: string };

async function readSession(req: NextRequest, cookie: string, audience: "customer" | "staff"): Promise<Session | null> {
  const token = req.cookies.get(cookie)?.value;
  const secret = process.env.JWT_SECRET;
  // Fail closed: no secret configured means nobody is treated as signed in.
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      issuer: "bookwrms",
      audience,
    });
    return payload as unknown as Session;
  } catch {
    return null; // invalid, expired or the wrong kind of token
  }
}

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function withRequestId(res: NextResponse, requestId: string) {
  res.headers.set("x-request-id", requestId);
  return res;
}

/** A state-changing API call must come from our own pages. */
function isCrossSite(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host !== req.headers.get("host");
    } catch {
      return true;
    }
  }
  // Browsers that omit Origin still send Sec-Fetch-Site
  const site = req.headers.get("sec-fetch-site");
  return site === "cross-site";
}

export async function proxy(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method) && isCrossSite(req)) {
    return withRequestId(
      NextResponse.json({ success: false, error: "Cross-site request blocked" }, { status: 403 }),
      requestId
    );
  }

  // The old placeholder staff page
  if (pathname === "/admin-portal-login-obscure") {
    return withRequestId(NextResponse.redirect(new URL(STAFF_LOGIN_PAGE, req.url)), requestId);
  }

  if (startsWithAny(pathname, STAFF_PREFIXES) || pathname === STAFF_LOGIN_PAGE) {
    const staff = await readSession(req, "staff_token", "staff");
    if (pathname === STAFF_LOGIN_PAGE) {
      if (staff) return withRequestId(NextResponse.redirect(new URL("/admin", req.url)), requestId);
    } else if (!staff) {
      const loginUrl = new URL(STAFF_LOGIN_PAGE, req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return withRequestId(NextResponse.redirect(loginUrl), requestId);
    }
  }

  const isAuthPage = startsWithAny(pathname, AUTH_PAGES);
  // Which pages need a customer, including the guest-checkout exceptions: lib/route-access.ts
  const isProtected = requiresCustomerSession(pathname, req.nextUrl.searchParams);
  if (isAuthPage || isProtected) {
    const session = await readSession(req, "auth_token", "customer");
    if (session && isAuthPage) {
      return withRequestId(NextResponse.redirect(new URL("/", req.url)), requestId);
    }
    if (!session && isProtected) {
      const loginUrl = new URL(LOGIN_PAGE, req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return withRequestId(NextResponse.redirect(loginUrl), requestId);
    }
  }

  const forwarded = new Headers(req.headers);
  forwarded.set("x-request-id", requestId);
  return withRequestId(NextResponse.next({ request: { headers: forwarded } }), requestId);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|images/).*)"],
};
