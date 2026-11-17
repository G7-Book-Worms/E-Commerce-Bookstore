// Email verification at sign-up: an account is only created once its owner types the 6-digit
// code we email to the address they gave.
//
// Nothing is written to the database until the code is right. The form's details travel in a
// signed, httpOnly cookie (path /api/auth/register, 15 minutes) together with an HMAC of the code:
//   - the cookie is signed, so its details can't be edited between the two steps;
//   - the code is keyed with JWT_SECRET, so reading your own cookie doesn't reveal it;
//   - wrong guesses are limited per email (5 per 15 minutes) in the shared rate-limit table.
// The password is already a bcrypt hash inside the cookie, never the password itself.
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { JWT_ISSUER } from '../../shared/utils/token-util';

export const REGISTER_PENDING_COOKIE = 'reg_pending';
export const REGISTER_PENDING_SECONDS = 15 * 60;
const AUDIENCE = 'register-pending';
const TIMED_OUT = 'Your sign-up timed out. Fill in the form again and we will send a new code.';

export interface PendingRegistration {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  /** HMAC of the current code; a resend replaces it */
  codeHash: string;
  nonce: string;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  return s;
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(email: string, nonce: string, code: string): string {
  return createHmac('sha256', secret()).update(`register:${email}:${nonce}:${code}`).digest('hex');
}

/** A fresh code for these details: the details plus the code's hash, ready to sign. */
export function withCode(details: Omit<PendingRegistration, 'codeHash' | 'nonce'>, code: string): PendingRegistration {
  const nonce = randomBytes(12).toString('hex');
  return { ...details, nonce, codeHash: hashCode(details.email, nonce, code) };
}

export function signPendingRegistration(p: PendingRegistration): string {
  return jwt.sign({ reg: p }, secret(), {
    algorithm: 'HS256', expiresIn: REGISTER_PENDING_SECONDS, issuer: JWT_ISSUER, audience: AUDIENCE,
  } as jwt.SignOptions);
}

export function readPendingRegistration(token: string | undefined): PendingRegistration {
  if (!token) throw new UnauthorizedError(TIMED_OUT);
  try {
    const p = (jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: AUDIENCE }) as jwt.JwtPayload).reg;
    const ok = p && ['firstName', 'lastName', 'email', 'passwordHash', 'codeHash', 'nonce'].every((k) => typeof p[k] === 'string' && p[k]);
    if (!ok) throw new Error('bad payload');
    return { ...p, phone: typeof p.phone === 'string' ? p.phone : null } as PendingRegistration;
  } catch {
    throw new UnauthorizedError(TIMED_OUT);
  }
}

export function codeMatches(p: PendingRegistration, code: string): boolean {
  const digits = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(digits)) return false;
  return timingSafeEqual(Buffer.from(hashCode(p.email, p.nonce, digits)), Buffer.from(p.codeHash));
}

export const registerPendingCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth/register',
  maxAge: REGISTER_PENDING_SECONDS,
};
