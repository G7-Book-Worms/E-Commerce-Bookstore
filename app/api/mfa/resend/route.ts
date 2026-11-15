// POST /api/mfa/resend -> emails a new sign-in code (also "use an email code instead" for
// someone whose authenticator app isn't to hand). Rate-limited per account in mfa-service.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { MFA_PENDING_COOKIE, pendingCookieOptions, resendEmailCode } from '@/server/src/modules/mfa/mfa-service';

export const POST = createApiHandler(async (req: NextRequest) => {
  const step = await resendEmailCode(req.cookies.get(MFA_PENDING_COOKIE)?.value, clientIp(req));
  const res = HttpResponse.success({ method: step.method, sentTo: step.sentTo }, 'A new code is on its way');
  res.cookies.set(MFA_PENDING_COOKIE, step.pendingToken, pendingCookieOptions);
  return res;
});
