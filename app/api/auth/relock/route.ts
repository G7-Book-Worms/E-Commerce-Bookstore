// POST /api/auth/relock { token }: the "Lock My Account" link from the account-unlocked email.
// See server/src/modules/auth/account-relock.ts.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { relockAccount } from '@/server/src/modules/auth/account-relock';

export const POST = createApiHandler(async (req: NextRequest) => {
  await rateLimit(`relock:ip:${clientIp(req)}`, 10, 60 * 60);
  const body = await req.json().catch(() => ({}));
  const { ticketNumber, kind } = await relockAccount(body?.token, clientIp(req));
  return HttpResponse.success({ ticketNumber, kind }, 'Your account is locked');
});
