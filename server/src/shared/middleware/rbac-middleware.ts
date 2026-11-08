import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from './auth-middleware';
import { ForbiddenError } from '../errors/app-error';

type HandlerWithContext = (req: NextRequest, context?: any) => Promise<NextResponse>;

/**
 * SCRUM-87: Require specific roles to access a route handler.
 * If user lacks the role, it throws a ForbiddenError (403 Forbidden).
 */
export function requireRole(allowedRoles: Array<'admin' | 'customer'>) {
  return function (handler: HandlerWithContext): HandlerWithContext {
    return async (req: NextRequest, context?: any) => {
      // Authenticate session first
      const { payload } = authenticateRequest(req);

      if (!allowedRoles.includes(payload.role)) {
        throw new ForbiddenError('You do not have permission to perform this action');
      }

      return handler(req, context);
    };
  };
}