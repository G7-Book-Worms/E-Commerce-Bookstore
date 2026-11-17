// POST /api/mfa/verify { code } -> finishes a sign-in that needed a second step.
// Who is signing in comes from the httpOnly pending cookie set by the password step, never
// from the request body, and the right session cookie (customer or staff) is issued here.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { setAuthCookie, setStaffCookie } from '@/server/src/shared/utils/cookie-utils';
import { MFA_PENDING_COOKIE, mfaCodeSchema, pendingCookieOptions, verifySecondStep } from '@/server/src/modules/mfa/mfa-service';
import { completeStaffSignIn } from '@/server/src/modules/staff/staff-auth';
import { AuthService } from '@/server/src/modules/auth/auth-service';
import { UsersRepository } from '@/server/src/modules/users/users-repository';
import { UnauthorizedError } from '@/server/src/shared/errors/app-error';

export const POST = createApiHandler(async (req: NextRequest) => {
  const { code } = mfaCodeSchema.parse(await req.json());
  const ip = clientIp(req);
  const who = await verifySecondStep(req.cookies.get(MFA_PENDING_COOKIE)?.value, code, ip);

  if (who.kind === 'staff') {
    const { token, mustChangePassword } = await completeStaffSignIn(who.id, ip);
    const res = HttpResponse.success({ kind: 'staff', mustChangePassword }, 'Signed in');
    setStaffCookie(res, token);
    res.cookies.set(MFA_PENDING_COOKIE, '', { ...pendingCookieOptions, maxAge: 0 });
    return res;
  }

  const user = await new UsersRepository().findById(who.id);
  if (!user || !user.isActive) throw new UnauthorizedError('Please sign in again');
  const result = await new AuthService().completeSignIn(user, who.remember, ip);
  const res = HttpResponse.success({ kind: 'customer', user: result.user }, 'Logged in successfully');
  setAuthCookie(res, result.token, who.remember);
  res.cookies.set(MFA_PENDING_COOKIE, '', { ...pendingCookieOptions, maxAge: 0 });
  return res;
});
