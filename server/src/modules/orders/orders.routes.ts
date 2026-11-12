import { NextRequest } from 'next/server';
import { createApiHandler } from '../../server';
import { OrdersController } from './orders-controller';
import { authenticateRequest, withAuthHeaders } from '../../shared/middleware/auth-middleware';

export const GET = createApiHandler(async (req: NextRequest) => {
  const { headers } = authenticateRequest(req);
  const mutatedReq = withAuthHeaders(req, headers);
  return OrdersController.listUserOrders(mutatedReq);
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const { headers } = authenticateRequest(req);
  const mutatedReq = withAuthHeaders(req, headers);
  return OrdersController.create(mutatedReq);
});