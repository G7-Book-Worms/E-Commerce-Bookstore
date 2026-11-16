// POST /api/passkeys/sign-in { step: 'options', kind } -> WebAuthn options + challenge cookie
// POST /api/passkeys/sign-in { step: 'verify', kind, response } -> checks the device's answer and
// issues the session (customer cookie, or staff cookie for kind 'staff').
//
// A passkey sign-in needs no password and no second step: the device has already checked the
// person (fingerprint, face or PIN) and proved it holds the key. Customer passkeys only open
// customer accounts and staff passkeys only the staff portal.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { setAuthCookie, setStaffCookie } from '@/server/src/shared/utils/cookie-utils';
import { UnauthorizedError } from '@/server/src/shared/errors/app-error';
import { PASSKEY_COOKIE, passkeyCookieOptions, signInOptions, signInSchema, verifySignIn } from '@/server/src/modules/passkeys/passkey-service';
import { completeStaffSignIn } from '@/server/src/modules/staff/staff-auth';
import { AuthService } from '@/server/src/modules/auth/auth-service';
import { UsersRepository } from '@/server/src/modules/users/users-repository';

const stepSchema = z.object({ step: z.enum(['options', 'verify']), kind: z.enum(['customer', 'staff']).default('customer') }).passthrough();

export const POST = createApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { step, kind } = stepSchema.parse(body);
  const ip = clientIp(req);

  if (step === 'options') {
    const { options, cookie } = await signInOptions(kind, req.url, ip);
    const res = HttpResponse.success({ options }, 'Use your passkey');
    res.cookies.set(PASSKEY_COOKIE, cookie, passkeyCookieOptions);
    return res;
  }

  const { response } = signInSchema.parse(body);
  const who = await verifySignIn(kind, response as unknown as AuthenticationResponseJSON, req.cookies.get(PASSKEY_COOKIE)?.value, req.url, ip);
  const how = { method: 'passkey', passkey: who.passkeyName };

  if (who.kind === 'staff') {
    const { token, mustChangePassword } = await completeStaffSignIn(who.id, ip, how);
    const res = HttpResponse.success({ kind: 'staff', mustChangePassword }, 'Signed in');
    setStaffCookie(res, token);
    res.cookies.set(PASSKEY_COOKIE, '', { ...passkeyCookieOptions, maxAge: 0 });
    return res;
  }

  const user = await new UsersRepository().findById(who.id);
  if (!user || !user.isActive) throw new UnauthorizedError('Please sign in again');
  // A passkey stays signed in like "Remember me": it's a device the person chose to trust
  const result = await new AuthService().completeSignIn(user, true, ip, how);
  const res = HttpResponse.success({ kind: 'customer', user: result.user }, 'Logged in successfully');
  setAuthCookie(res, result.token, true);
  res.cookies.set(PASSKEY_COOKIE, '', { ...passkeyCookieOptions, maxAge: 0 });
  return res;
});
