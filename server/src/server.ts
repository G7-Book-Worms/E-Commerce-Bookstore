import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '../src/shared/errors/app-error';
import { HttpResponse } from '../src/shared/http/api-response';

type HandlerFn = (req: NextRequest, context?: any) => Promise<NextResponse>;

export function createApiHandler(handler: HandlerFn): HandlerFn {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (error: any) {
      console.error(`[API Error] ${req.method} ${req.nextUrl.pathname}:`, error);

      if (error instanceof AppError) {
        return HttpResponse.error(error.message, error.statusCode);
      }

      return HttpResponse.internalError('An unexpected server error occurred');
    }
  };
}