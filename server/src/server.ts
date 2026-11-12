import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { AppError } from '../src/shared/errors/app-error';
import { HttpResponse } from '../src/shared/http/api-response';

type HandlerFn = (req: NextRequest, context?: any) => Promise<NextResponse>;

export function createApiHandler(handler: HandlerFn): HandlerFn {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error: any) {
      // Let Next.js handle its own control-flow errors (e.g. bailing out of prerendering
      // when a GET handler reads cookies at build time) instead of turning them into a 500.
      unstable_rethrow(error);
      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, error);

      if (error instanceof AppError) {
        return HttpResponse.error(error.message, error.statusCode);
      }

      return HttpResponse.internalError('An unexpected server error occurred');
    }
  };
}