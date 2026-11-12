import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';
import { AppError } from '../src/shared/errors/app-error';
import { HttpResponse } from '../src/shared/http/api-response';

type HandlerFn = (req: NextRequest, context?: any) => Promise<NextResponse>;

/**
 * Wraps a route handler so every error becomes a JSON { success: false, error } response.
 * - AppError subclasses keep their status code and message (they are written for users).
 * - Zod validation errors become 400 with the first validation message.
 * - A body that is not valid JSON becomes 400.
 * - Anything else (database errors, bugs) is logged on the server and the client only
 *   sees a generic 500, so raw SQL/driver messages never leak.
 */
export function createApiHandler(handler: HandlerFn): HandlerFn {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error: any) {
      // Let Next.js handle its own control-flow errors (e.g. bailing out of prerendering
      // when a GET handler reads cookies at build time) instead of turning them into a 500.
      unstable_rethrow(error);

      if (error instanceof AppError) {
        return HttpResponse.error(error.message, error.statusCode);
      }

      if (error instanceof ZodError) {
        return HttpResponse.badRequest(error.issues[0]?.message || 'Invalid request data');
      }

      if (error instanceof SyntaxError) {
        return HttpResponse.badRequest('Request body must be valid JSON');
      }

      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, error);
      return HttpResponse.internalError('An unexpected server error occurred');
    }
  };
}
