import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/app-error';

export interface JwtPayload {
  id: number;
  email: string;
  role: 'customer' | 'admin' | 'employee' | 'manager';
}


/**
 * Retrieve the active secret, falling back to process.env if env object is unpopulated
 */
function getJwtSecret(): string {
  const secret = env?.JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET configuration is missing on the server');
  }
  return secret;
}

/**
 * Sign JWT token with 7-day expiration (or env configured expiration)
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '7d',
  });
}

/**
 * Verify JWT signature and unpack token claims
 */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch (error: any) {
    throw new UnauthorizedError('Invalid or expired authentication session');
  }
}