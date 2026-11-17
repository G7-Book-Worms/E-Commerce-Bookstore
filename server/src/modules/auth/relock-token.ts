// The signed "Lock My Account" link in the account-unlocked email (see account-relock.ts).
// Kept apart so the security alerts can sign one without importing the ticket system.
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { BadRequestError } from '../../shared/errors/app-error';
import { JWT_ISSUER } from '../../shared/utils/token-util';

const AUDIENCE = 'account-relock';
export const RELOCK_LINK_DAYS = 7;
export const BAD_RELOCK_LINK = 'This link is invalid or has expired. If you think someone else is using your account, reset your password with "Forgot Password?" and contact support.';

type Kind = 'customer' | 'staff';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  return s;
}

/**
 * Each link has its own id (`jti`), recorded when used, so it works once (account-relock.ts).
 * A password reset by the owner voids links issued before it (`iat` is checked against it).
 * Deliberately NOT tied to the session token version: an intruder signing out or changing the
 * password must not be able to kill the owner's undo link.
 */
export function signRelockToken(kind: Kind, id: number): string {
  return jwt.sign({ k: kind }, secret(), {
    algorithm: 'HS256', expiresIn: `${RELOCK_LINK_DAYS}d`, issuer: JWT_ISSUER, audience: AUDIENCE, subject: String(id),
    jwtid: randomBytes(16).toString('hex'),
  } as jwt.SignOptions);
}

export function readRelockToken(token: unknown): { kind: Kind; id: number; jti: string; iat: number; exp: number } {
  if (typeof token !== 'string' || token.length > 2000) throw new BadRequestError(BAD_RELOCK_LINK);
  try {
    const p = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: AUDIENCE }) as jwt.JwtPayload;
    const kind = p.k === 'staff' ? 'staff' : p.k === 'customer' ? 'customer' : null;
    const id = Number(p.sub);
    const jti = typeof p.jti === 'string' && /^[0-9a-f]{32}$/.test(p.jti) ? p.jti : null;
    if (!kind || !Number.isInteger(id) || id <= 0 || !jti || !p.iat || !p.exp) throw new Error('bad payload');
    return { kind, id, jti, iat: Number(p.iat), exp: Number(p.exp) };
  } catch {
    throw new BadRequestError(BAD_RELOCK_LINK);
  }
}


/** Rate-limit-table key that marks a link as used (kept until the link would have expired). */
export const relockUsedKey = (jti: string) => `relock-used:${jti}`;
/** Written by the owner's password reset: links issued before it no longer work. */
export const relockVoidKey = (kind: Kind, id: number) => `relock-void:${kind}:${id}`;
