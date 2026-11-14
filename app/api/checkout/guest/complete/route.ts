// POST /api/checkout/guest/complete { sessionId } -> { orderId, email, viewToken }
//
// Called by the success page after a guest pays: asks Stripe whether that session was really
// paid, then takes the books out of stock, marks the payment completed and emails the
// confirmation with a signed link to the order.
//
// The Stripe session id is the only thing proving the caller just paid, and it is unguessable;
// the endpoint still refuses any session whose order belongs to an account, so it can never be
// used to touch a registered customer's order. Unauthenticated, so it is rate-limited per IP.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { clientIp } from '@/server/src/shared/security/client-ip';
import {
  completeGuestCheckout,
  completeGuestCheckoutSchema,
} from '@/server/src/modules/checkout/guest-checkout-service';

export const POST = createApiHandler(async (req: NextRequest) => {
  // Higher than starting a checkout: refreshing the success page legitimately calls this again.
  await rateLimit(`checkout:guest:complete:ip:${clientIp(req)}`, 30, 3600);

  const { sessionId } = await validateBody(req, completeGuestCheckoutSchema);
  const result = await completeGuestCheckout(sessionId);
  // `viewToken` goes to the browser that just paid (and to no one else) so the success page can
  // offer the same "view this order" link as the email. It is never written to the log.
  return HttpResponse.success(result, 'Order placed');
});
