import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from './auth-service';
import { registerInputSchema, loginInputSchema } from './auth-schema';
import { HttpResponse } from '../../shared/http/api-response';
import { HttpStatus } from '../../shared/http/status-codes';
import { env } from '../../config/env';

const authService = new AuthService();
const COOKIE_NAME = 'auth_token';

/**
 * Configure standard secure HTTP-Only cookie parameters
 */
function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds (604,800s)
  });
}

export class AuthController {
  /**
   * SCRUM-78: POST /api/auth/register (201 Created)
   */
  static async register(req: NextRequest) {
    const body = await req.json();
    const validatedInput = registerInputSchema.parse(body);

    const result = await authService.register(validatedInput);

    const response = HttpResponse.created(result, 'User registered successfully');
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

    const response = HttpResponse.success(result, 'Logged in successfully');
    setAuthCookie(response, result.token);
    return response;
  }

  /**
   * SCRUM-85: GET /api/auth/me
   */
 
// server/src/modules/auth/auth-controller.ts
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

    // Clear the HTTP cookie by setting maxAge to 0
    response.cookies.set({
      name: COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  }
}