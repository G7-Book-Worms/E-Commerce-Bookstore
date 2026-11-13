// POST /api/checkout/complete { sessionId } -> { orderId }
// Called by the success page: confirms with Stripe that the order was paid, then finalizes it.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/server/src/server';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { validateBody } from '@/server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { completeCheckout } from '@/server/src/modules/checkout/checkout-service';

const completeSchema = z.object({ sessionId: z.string().startsWith('cs_', 'Invalid checkout session').max(255) });

export const POST = createApiHandler(async (req: NextRequest) => {
  const { user } = await authenticateRequest(req);
  const { sessionId } = await validateBody(req, completeSchema);
  const result = await completeCheckout(Number(user.id), sessionId);
  return HttpResponse.success(result, 'Order placed');
});
