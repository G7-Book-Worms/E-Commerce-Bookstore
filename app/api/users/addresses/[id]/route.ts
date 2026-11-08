import { NextRequest } from 'next/server';
import { createApiHandler } from '../../../../../server/src/server';
import { UsersController } from '../../../../../server/src/modules/users/users-controller';
import { authenticateRequest } from '../../../../../server/src/shared/middleware/auth-middleware';

export const PATCH = createApiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { headers } = authenticateRequest(req);
  return UsersController.updateAddress(new NextRequest(req.url, { headers, body: req.body }), Number(id));
});

export const DELETE = createApiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { headers } = authenticateRequest(req);
  return UsersController.deleteAddress(new NextRequest(req.url, { headers }), Number(id));
});