// GET /api/orders/:orderId -> one of the logged-in user's orders with lines, address and payment
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { BadRequestError } from '@/server/src/shared/errors/app-error';
import { getOrderSummary } from '@/server/src/modules/checkout/checkout-service';

export const GET = createApiHandler(async (req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) => {
  const { user } = await authenticateRequest(req);
  const orderId = Number((await ctx.params).orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) throw new BadRequestError('Invalid order id');
  return HttpResponse.success(await getOrderSummary(Number(user.id), orderId));
});
