// POST /api/checkout/guest/order { token } -> that one guest order
//
// The "view your order" link from a guest's confirmation email. The order id is read out of the
// signed token (see server/src/modules/checkout/guest-order-token.ts) and never from the URL, so
// a holder of one link cannot reach any other order by changing a number.
//
// It is a POST on purpose: the token travels in the request body, not in a query string that
// would end up in server access logs. The response leaves out the guest's email and street for
// the same reason a forwarded email shouldn't give the whole order away.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { clientIp } from '@/server/src/shared/security/client-ip';
import {
  getGuestOrderByToken,
  guestOrderTokenSchema,
} from '@/server/src/modules/checkout/guest-checkout-service';

export const POST = createApiHandler(async (req: NextRequest) => {
  // Unauthenticated: cap how fast anyone can throw made-up tokens at this.
  await rateLimit(`checkout:guest:order:ip:${clientIp(req)}`, 60, 3600);

  const { token } = await validateBody(req, guestOrderTokenSchema);
  // An invalid, expired or tampered token throws a 401 from verifyGuestOrderToken; the token
  // itself is never logged or echoed back.
  const order = await getGuestOrderByToken(token);
  return HttpResponse.success(order, 'Order retrieved');
});
