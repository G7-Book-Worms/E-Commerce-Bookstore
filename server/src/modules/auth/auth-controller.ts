import { NextRequest } from 'next/server';
import { AuthService } from './auth-service';
import { registerInputSchema, loginInputSchema } from './auth-schema';
import { HttpResponse } from '../../shared/http/api-response';
import { HttpStatus } from '../../shared/http/status-codes';
import { setAuthCookie, clearAuthCookie } from '../../shared/utils/cookie-utils';

const authService = new AuthService();

export class AuthController {
  /**
   * SCRUM-78: POST /api/auth/register (201 Created)
   */
  static async register(req: NextRequest) {
    const body = await req.json();
    const validatedInput = registerInputSchema.parse(body);

    const result = await authService.register(validatedInput);

    // The token only goes in the httpOnly cookie, never in the JSON body
    const response = HttpResponse.created({ user: result.user }, 'User registered successfully');
    setAuthCookie(response, result.token);
    return response;
  }

  /**
   * SCRUM-81 & SCRUM-82: POST /api/auth/login
   */
  static async login(req: NextRequest) {
    const body = await req.json();
    const validatedInput = loginInputSchema.parse(body);

    const result = await authService.login(validatedInput);

    const response = HttpResponse.success({ user: result.user }, 'Logged in successfully');
    setAuthCookie(response, result.token);
    return response;
  }

  /**
   * SCRUM-85: GET /api/auth/me
   */
  static async getMe(req: NextRequest) {
    const userIdHeader = req.headers.get('x-user-id');
    const numericUserId = Number(userIdHeader);

    if (!userIdHeader || isNaN(numericUserId)) {
      return HttpResponse.error('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const user = await authService.getMe(numericUserId);
    if (!user) {
      return HttpResponse.error('User not found', HttpStatus.UNAUTHORIZED);
    }

    return HttpResponse.success({ user }, 'Session retrieved');
  }
  /**
   * SCRUM-86: POST /api/auth/logout
   */
  static async logout() {
    const response = HttpResponse.success({ loggedOut: true }, 'Logged out successfully');

    clearAuthCookie(response);

    return response;
  }
}