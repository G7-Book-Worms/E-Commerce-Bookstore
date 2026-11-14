// POST /api/checkout/guest { email, address, items, discountCode?, note? } -> { orderId, url }
//
// Starts a checkout for someone without an account (SCRUM-208): re-prices the basket on the
// server, saves the address and the order, and returns the Stripe Checkout page to send the
// shopper to. The browser never sends prices, totals or a discount amount.
//
// This endpoint is unauthenticated, so it is one of the most exposed surfaces in the app: it is
// rate-limited per IP and every field is validated with zod (see guest-checkout-service.ts)
// before anything is written or sent to Stripe.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { clientIp } from '@/server/src/shared/security/client-ip';
import {
  startGuestCheckout,
  startGuestCheckoutSchema,
} from '@/server/src/modules/checkout/guest-checkout-service';

export const POST = createApiHandler(async (req: NextRequest) => {
  // Each attempt creates an order row and a Stripe session, so this is the tightest limit:
  // 10 per hour per IP, plus a short burst limit so a script can't fire them back to back.
  const ip = clientIp(req);
  await rateLimit(`checkout:guest:start:burst:ip:${ip}`, 3, 60);
  await rateLimit(`checkout:guest:start:ip:${ip}`, 10, 3600);

  const input = await validateBody(req, startGuestCheckoutSchema);
  // Where Stripe sends the shopper back to (set SITE_URL when deployed behind a proxy)
  const origin = process.env.SITE_URL ?? req.nextUrl.origin;
  const result = await startGuestCheckout(input, origin);
  return HttpResponse.created(result, 'Guest checkout started');
});
