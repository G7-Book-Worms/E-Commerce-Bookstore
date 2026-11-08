// server/src/modules/auth/auth-route.ts
import { NextRequest } from 'next/server';
import { createApiHandler } from '../../server';
import { AuthController } from './auth-controller';
import { authenticateRequest } from '../../shared/middleware/auth-middleware';
import { HttpResponse } from '../../shared/http/api-response';

export const handleRegister = createApiHandler(AuthController.register);
export const handleLogin = createApiHandler(AuthController.login);
export const handleLogout = createApiHandler(AuthController.logout);

// GET /api/auth/me
export const handleGetMe = createApiHandler(async (req: NextRequest) => {
  try {
    const { headers } = authenticateRequest(req);
    const mutatedReq = new NextRequest(req.url, { headers });
    return AuthController.getMe(mutatedReq);
  } catch {
    return HttpResponse.success({ user: null }, 'Unauthenticated');
  }
});