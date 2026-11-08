// server/src/shared/middleware/auth-middleware.ts
import { NextRequest } from 'next/server';
import { UnauthorizedError } from '../errors/app-error';
import { verifyToken } from '../utils/token-util';

export function authenticateRequest(req: NextRequest) {
  // Check the cookie name matching your AuthController: 'auth_token'
  let token = req.cookies.get('auth_token')?.value || req.cookies.get('token')?.value;

  // Fall back to Bearer header
  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token is missing');
  }

  const payload = verifyToken(token);
  if (!payload || !payload.id) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', String(payload.id));
  requestHeaders.set('x-user-email', payload.email || '');
  requestHeaders.set('x-user-role', payload.role || 'customer');

  return {
    headers: requestHeaders,
    user: payload,
  };
}