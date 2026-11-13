// server/src/modules/auth/auth-route.ts
import { NextRequest } from 'next/server';
import { createApiHandler } from '../../server';
import { AuthController } from './auth-controller';
import { authenticateRequest, withAuthHeaders } from '../../shared/middleware/auth-middleware';
import { HttpResponse } from '../../shared/http/api-response';
import { clearAuthCookie } from '../../shared/utils/cookie-utils';

export const handleRegister = createApiHandler(AuthController.register);
export const handleLogin = createApiHandler(AuthController.login);
export const handleLogout = createApiHandler(AuthController.logout);
export const handleForgotPassword = createApiHandler(AuthController.forgotPassword);
export const handleResetPassword = createApiHandler(AuthController.resetPassword);

// GET /api/auth/me: a stale or invalid cookie is cleared so the browser stops sending it
export const handleGetMe = createApiHandler(async (req: NextRequest) => {
  try {
    const { headers } = await authenticateRequest(req);
    return await AuthController.getMe(withAuthHeaders(req, headers));
  } catch {
    const response = HttpResponse.success({ user: null }, 'Unauthenticated');
    if (req.cookies.get('auth_token')) clearAuthCookie(response);
    return response;
  }
});
