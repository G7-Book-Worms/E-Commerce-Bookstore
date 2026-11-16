import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { requireHuman } from '@/server/src/shared/security/turnstile';
import { staffLogin, staffLoginSchema } from '@/server/src/modules/staff/staff-auth';
import { MFA_PENDING_COOKIE, pendingCookieOptions } from '@/server/src/modules/mfa/mfa-service';

// POST /api/staff/login { email, password, employeeId }
// A correct password never signs a staff member straight in: two-step sign-in is required, so
// this answers "enter your code" and the session cookie comes from POST /api/mfa/verify.
export const POST = createApiHandler(async (req: NextRequest) => {
  await requireHuman(req, clientIp(req), 'staff_login');
  const input = staffLoginSchema.parse(await req.json());
  const { mfa } = await staffLogin(input, clientIp(req));
  const res = HttpResponse.success({ mfaRequired: true, method: mfa.method, sentTo: mfa.sentTo }, 'Enter your sign-in code');
  res.cookies.set(MFA_PENDING_COOKIE, mfa.pendingToken, pendingCookieOptions);
  return res;
});
