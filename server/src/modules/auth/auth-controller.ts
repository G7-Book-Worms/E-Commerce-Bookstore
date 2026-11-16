import { NextRequest } from 'next/server';
import { AuthService } from './auth-service';
import { registerInputSchema, loginInputSchema, forgotPasswordSchema, resetPasswordSchema } from './auth-schema';
import { HttpResponse } from '../../shared/http/api-response';
import { HttpStatus } from '../../shared/http/status-codes';
import { setAuthCookie, clearAuthCookie, AUTH_COOKIE_NAME } from '../../shared/utils/cookie-utils';
import { clientIp } from '../../shared/security/client-ip';
import { verifyToken } from '../../shared/utils/token-util';
import { MFA_PENDING_COOKIE, pendingCookieOptions } from '../mfa/mfa-service';
import { requireHuman } from '../../shared/security/turnstile';
import { REGISTER_PENDING_COOKIE, registerPendingCookieOptions } from './email-verification';
import { z } from 'zod';

const registerCodeSchema = z.object({ code: z.string().trim().min(6, 'Enter the 6-digit code').max(12, 'Enter the 6-digit code') });

const authService = new AuthService();

export class AuthController {
  /**
   * POST /api/auth/register: checks the details and emails a 6-digit code. The account is only
   * created by /api/auth/register/verify once the code is typed in.
   */
  static async register(req: NextRequest) {
    await requireHuman(req, clientIp(req), 'register');
    const validatedInput = registerInputSchema.parse(await req.json());
    const { pendingToken, sentTo } = await authService.startRegistration(validatedInput, clientIp(req));
    const response = HttpResponse.success({ verificationRequired: true, sentTo }, 'Check your email for a code');
    response.cookies.set(REGISTER_PENDING_COOKIE, pendingToken, registerPendingCookieOptions);
    return response;
  }

  /** POST /api/auth/register/verify { code } (201 Created): creates the account and signs it in */
  static async verifyRegistration(req: NextRequest) {
    const { code } = registerCodeSchema.parse(await req.json());
    const result = await authService.completeRegistration(req.cookies.get(REGISTER_PENDING_COOKIE)?.value, code, clientIp(req));
    // The token only goes in the httpOnly cookie, never in the JSON body
    const response = HttpResponse.created({ user: result.user }, 'User registered successfully');
    setAuthCookie(response, result.token);
    response.cookies.set(REGISTER_PENDING_COOKIE, '', { ...registerPendingCookieOptions, maxAge: 0 });
    return response;
  }

  /** POST /api/auth/register/resend: a new code (the old one stops working) */
  static async resendRegistrationCode(req: NextRequest) {
    const { pendingToken, sentTo } = await authService.resendRegistrationCode(req.cookies.get(REGISTER_PENDING_COOKIE)?.value);
    const response = HttpResponse.success({ sentTo }, 'A new code is on its way');
    response.cookies.set(REGISTER_PENDING_COOKIE, pendingToken, registerPendingCookieOptions);
    return response;
  }

  /** POST /api/auth/login */
  static async login(req: NextRequest) {
    await requireHuman(req, clientIp(req), 'login');
    const validatedInput = loginInputSchema.parse(await req.json());
    const result = await authService.login(validatedInput, clientIp(req));
    if ('mfa' in result) {
      // Password was right; the session cookie waits for the second step (/api/mfa/verify)
      const response = HttpResponse.success(
        { mfaRequired: true, method: result.mfa.method, sentTo: result.mfa.sentTo },
        'Enter your sign-in code'
      );
      response.cookies.set(MFA_PENDING_COOKIE, result.mfa.pendingToken, pendingCookieOptions);
      return response;
    }
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
    await requireHuman(req, clientIp(req), 'forgot_password');
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
