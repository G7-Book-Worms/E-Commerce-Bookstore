// app/api/users/orders/route.ts
// GET /api/users/orders?page=1&limit=10 -> the logged-in user's orders, newest first, with items.
import { NextRequest } from 'next/server';
import { createApiHandler } from '../../../../server/src/server';
import { UsersController } from '../../../../server/src/modules/users/users-controller';
import { authenticateRequest, withAuthHeaders } from '../../../../server/src/shared/middleware/auth-middleware';

export const GET = createApiHandler(async (req: NextRequest) => {
  const { headers } = await authenticateRequest(req);
  return UsersController.getOrders(withAuthHeaders(req, headers));
});
