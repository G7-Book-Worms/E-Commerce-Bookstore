// POST /api/checkout { shippingAddressId, discountCode?, note? } -> { orderId, url }
// Prices the cart on the server and returns the Stripe Checkout page to send the shopper to.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/server/src/server';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { startCheckout } from '@/server/src/modules/checkout/checkout-service';

const startSchema = z.object({
  shippingAddressId: z.number().int().positive('Choose a shipping address'),
  discountCode: z.string().trim().max(32).optional(),
  note: z.string().trim().max(500).optional(),
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const { user } = authenticateRequest(req);
  const input = await validateBody(req, startSchema);
  // Where Stripe sends the shopper back to (set SITE_URL when deployed behind a proxy)
  const origin = process.env.SITE_URL ?? req.nextUrl.origin;
  const result = await startCheckout(Number(user.id), String(user.email), input, origin);
  return HttpResponse.created(result, 'Checkout started');
});
