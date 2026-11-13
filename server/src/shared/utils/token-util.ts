import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors/app-error';

// Sign-in tokens (JWT, HS256). Customers and staff get different audiences and different
// cookies, so a customer token can never open the staff portal and vice versa.
// tv = token version: bumping users/admin.token_version invalidates every older token.
export const JWT_ISSUER = 'bookwrms';
export type TokenAudience = 'customer' | 'staff';
export type StaffRole = 'admin' | 'manager' | 'employee';

export interface JwtPayload {
  id: number;
  email: string;
  role: 'customer' | StaffRole;
  tv: number;
  // Customer chose "Remember me" (keeps a re-issued cookie the same kind)
  rem?: boolean;
}

const LIFETIME: Record<TokenAudience, string> = { customer: '7d', staff: '8h' };

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  }
  return secret;
}

export function generateToken(payload: JwtPayload, audience: TokenAudience = 'customer'): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: 'HS256',
    expiresIn: LIFETIME[audience],
    issuer: JWT_ISSUER,
    audience,
  } as jwt.SignOptions);
}

/** Verifies signature, algorithm, issuer, audience and expiry. */
export function verifyToken(token: string, audience: TokenAudience = 'customer'): JwtPayload {
  try {
    return jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience,
    }) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired authentication session');
  }
}
