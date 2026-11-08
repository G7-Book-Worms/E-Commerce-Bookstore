import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define public and protected route sets
const AUTH_PAGES = ['/login', '/register'];
const PROTECTED_PREFIXES = ['/User', '/cart', '/checkout', '/orders'];
const ADMIN_PREFIXES = ['/admin'];

interface TokenPayload {
  id: string;
  email: string;
  role: 'customer' | 'admin';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  let session: TokenPayload | null = null;

  // Verify JWT inside Edge Runtime using jose
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');
      const { payload } = await jwtVerify(token, secret);
      session = payload as unknown as TokenPayload;
    } catch {
      // Invalid/expired token
      session = null;
    }
  }

  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));
  const isProtectedPage = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAdminPage = ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // 1. Redirection for already-authenticated users trying to visit /login or /register
  if (session && isAuthPage) {
    const redirectUrl = session.role === 'admin' ? new URL('/admin', request.url) : new URL('/', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Unauthenticated user trying to access customer-only routes
  if (!session && isProtectedPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. User trying to access admin dashboard
  if (isAdminPage) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (session.role !== 'admin') {
      // Non-admins forbidden from viewing admin dashboard
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

/**
 * Configure paths that trigger the middleware guard
 */
export const config = {
  matcher: [
    '/login',
    '/register',
    '/User/:path*',
    '/cart/:path*',
    '/checkout/:path*',
    '/orders/:path*',
    '/admin/:path*',
  ],
};