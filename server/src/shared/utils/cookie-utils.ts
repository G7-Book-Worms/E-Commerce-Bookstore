// server/src/shared/utils/cookie-utils.ts
import { NextResponse } from 'next/server';

export const AUTH_COOKIE_NAME = 'auth_token';
export const STAFF_COOKIE_NAME = 'staff_token';
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

const base = {
  httpOnly: true, // JavaScript can't read it (protects against XSS token theft)
  secure: process.env.NODE_ENV === 'production', // HTTPS only on the live site
  sameSite: 'lax' as const, // not sent on cross-site form posts (CSRF)
  path: '/',
};

/**
 * Customer sign-in cookie. remember = true keeps it for 7 days; false makes it a
 * browser-session cookie ("Remember me" unchecked: closing the browser signs you out).
 */
export function setAuthCookie(response: NextResponse, token: string, remember: boolean = true): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, { ...base, ...(remember ? { maxAge: SEVEN_DAYS_IN_SECONDS } : {}) });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, '', { ...base, maxAge: 0, expires: new Date(0) });
}

/** Staff portal cookie: always a browser-session cookie, and the token itself expires after 8 hours. */
export function setStaffCookie(response: NextResponse, token: string): void {
  response.cookies.set(STAFF_COOKIE_NAME, token, { ...base, sameSite: 'strict' });
}

export function clearStaffCookie(response: NextResponse): void {
  response.cookies.set(STAFF_COOKIE_NAME, '', { ...base, sameSite: 'strict', maxAge: 0, expires: new Date(0) });
}
