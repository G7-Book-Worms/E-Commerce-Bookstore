// server/src/shared/utils/cookie-utils.ts
import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'auth_token';
const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

/**
 * Attaches the signed JWT as an HttpOnly, secure session cookie.
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SEVEN_DAYS_IN_SECONDS,
  });
}

/**
 * Clears the session cookie by setting maxAge to 0 and expiring the cookie.
 */
export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}