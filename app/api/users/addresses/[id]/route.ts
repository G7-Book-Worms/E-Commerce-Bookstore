import { NextRequest } from 'next/server';
import { BadRequestError } from '../../../../../server/src/shared/errors/app-error';
import { createApiHandler } from '../../../../../server/src/server';
import { UsersController } from '../../../../../server/src/modules/users/users-controller';
import { authenticateRequest, withAuthHeaders } from '../../../../../server/src/shared/middleware/auth-middleware';

export const PATCH = createApiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { headers } = authenticateRequest(req);
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new BadRequestError('Invalid address id');
  return UsersController.updateAddress(withAuthHeaders(req, headers), Number(id));
});

export const DELETE = createApiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { headers } = authenticateRequest(req);
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new BadRequestError('Invalid address id');
  return UsersController.deleteAddress(withAuthHeaders(req, headers), Number(id));
});