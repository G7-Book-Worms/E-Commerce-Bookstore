import { NextRequest } from 'next/server';
import { AuthService } from './auth-service';
import { registerInputSchema, loginInputSchema, forgotPasswordSchema, resetPasswordSchema } from './auth-schema';
import { HttpResponse } from '../../shared/http/api-response';
import { HttpStatus } from '../../shared/http/status-codes';
import { setAuthCookie, clearAuthCookie, AUTH_COOKIE_NAME } from '../../shared/utils/cookie-utils';
import { clientIp } from '../../shared/security/client-ip';
import { verifyToken } from '../../shared/utils/token-util';

const authService = new AuthService();

export class AuthController {
  /** POST /api/auth/register (201 Created) */
  static async register(req: NextRequest) {
    const validatedInput = registerInputSchema.parse(await req.json());
    const result = await authService.register(validatedInput, clientIp(req));
    // The token only goes in the httpOnly cookie, never in the JSON body
    const response = HttpResponse.created({ user: result.user }, 'User registered successfully');
    setAuthCookie(response, result.token);
    return response;
  }

  /** POST /api/auth/login */
  static async login(req: NextRequest) {
    const validatedInput = loginInputSchema.parse(await req.json());
    const result = await authService.login(validatedInput, clientIp(req));
    const response = HttpResponse.success({ user: result.user }, 'Logged in successfully');
    setAuthCookie(response, result.token, validatedInput.rememberMe ?? false);
    return response;
  }

  /** GET /api/auth/me */
  static async getMe(req: NextRequest) {
    const numericUserId = Number(req.headers.get('x-user-id'));
    if (!numericUserId) return HttpResponse.error('Unauthorized', HttpStatus.UNAUTHORIZED);
    const user = await authService.getMe(numericUserId);
    return HttpResponse.success({ user }, 'Session retrieved');
  }

  /**
   * POST /api/auth/logout
   *
   * Clearing the cookie alone does not end the session: the JWT stays valid until it expires,
   * so a copy captured before logout keeps working (pentest finding M-1). Bumping the user's
   * token_version revokes every outstanding token for them, the same mechanism a password
   * change uses. Logout stays idempotent - an already-invalid or missing token is not an error,
   * the cookie is cleared and 200 is returned regardless.
   */
  static async logout(req: NextRequest) {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      const payload = verifyToken(token, 'customer');
      if (payload?.id) {
        await authService.revokeSessions(Number(payload.id));
      }
    }
    const response = HttpResponse.success({ loggedOut: true }, 'Logged out successfully');
    clearAuthCookie(response);
    return response;
  }

  /** POST /api/auth/forgot-password: same answer whether or not the email has an account */
  static async forgotPassword(req: NextRequest) {
    const { email } = forgotPasswordSchema.parse(await req.json());
    await authService.requestPasswordReset(email, clientIp(req));
    return HttpResponse.success(
      { sent: true },
      "If that email has an account, we've sent a link to reset the password. It expires in 30 minutes."
    );
  }

  /** POST /api/auth/reset-password */
  static async resetPassword(req: NextRequest) {
    const input = resetPasswordSchema.parse(await req.json());
    await authService.resetPassword(input.token, input.newPassword, clientIp(req));
    const response = HttpResponse.success({ reset: true }, 'Password updated. You can sign in with it now.');
    clearAuthCookie(response);
    return response;
  }
}
