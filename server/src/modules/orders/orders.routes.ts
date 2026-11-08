import { NextRequest } from 'next/server';
import { createApiHandler } from '../../server';
import { OrdersController } from './orders-controller';
import { authenticateRequest } from '../../shared/middleware/auth-middleware';

export const GET = createApiHandler(async (req: NextRequest) => {
  const { headers } = authenticateRequest(req);
  const mutatedReq = new NextRequest(req.url, { headers });
  return OrdersController.listUserOrders(mutatedReq);
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const { headers } = authenticateRequest(req);
  const mutatedReq = new NextRequest(req.url, { headers });
  return OrdersController.create(mutatedReq);
});