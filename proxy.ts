import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const forwarded = new Headers(req.headers);
  forwarded.set("x-request-id", requestId);

  const res = NextResponse.next({ request: { headers: forwarded } });
  res.headers.set("x-request-id", requestId);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
