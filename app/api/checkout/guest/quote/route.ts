// POST /api/checkout/guest/quote { items, discountCode? } -> the guest's cart, priced here
//
// The guest's cart lives in their browser, so this is how the cart and checkout pages learn what
// those book ids actually cost. Every price, sale price, stock figure, discount and total in the
// response is read from the database; nothing about money that arrives in the body is used.
//
// Unauthenticated, so it is rate-limited per IP (it runs catalog queries).
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { priceGuestCart } from '@/server/src/modules/cart/guest-cart';
import { guestQuoteSchema } from '@/server/src/modules/checkout/guest-checkout-service';

export const POST = createApiHandler(async (req: NextRequest) => {
  // 120 quotes an hour per IP: enough for browsing and quantity changes, not for scraping.
  await rateLimit(`checkout:guest:quote:ip:${clientIp(req)}`, 120, 3600);

  const { items, discountCode } = await validateBody(req, guestQuoteSchema);
  const cart = await priceGuestCart(items, discountCode);
  return HttpResponse.success(cart, 'Cart priced');
});
