// POST /api/checkout/guest/order { token | orderId, email } -> that one guest order
//
// A guest proves the order is theirs with two things: the order number (or the signed link from
// their confirmation email, which carries it) AND the email address they ordered with. Either
// one alone shows nothing, so a forwarded link or a guessed number is useless.
//
// It is a POST on purpose: the token and email travel in the body, not in a query string that
// would end up in server access logs. Attempts are limited per IP and per order number, and
// every miss gets the same answer, so it can't be used to find out which orders exist.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { guestOrderLookupSchema, lookUpGuestOrder } from '@/server/src/modules/checkout/guest-checkout-service';

export const POST = createApiHandler(async (req: NextRequest) => {
  await rateLimit(`checkout:guest:order:ip:${clientIp(req)}`, 20, 15 * 60);
  const input = await validateBody(req, guestOrderLookupSchema);
  if (input.orderId) await rateLimit(`checkout:guest:order:id:${input.orderId}`, 10, 60 * 60);
  // Per email too, so knowing someone's address doesn't allow walking through order numbers
  await rateLimit(`checkout:guest:order:email:${input.email}`, 10, 60 * 60);
  return HttpResponse.success(await lookUpGuestOrder(input), 'Order retrieved');
});
