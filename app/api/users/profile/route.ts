import { NextRequest } from 'next/server';
import { createApiHandler } from '../../../../server/src/server';
import { UsersController } from '../../../../server/src/modules/users/users-controller';
import { authenticateRequest, withAuthHeaders } from '../../../../server/src/shared/middleware/auth-middleware';

// Copying the request keeps its method and body; only the auth headers are added.
export const GET = createApiHandler(async (req: NextRequest) => {
  const { headers } = await authenticateRequest(req);
  return UsersController.getProfile(withAuthHeaders(req, headers));
});

export const PATCH = createApiHandler(async (req: NextRequest) => {
  const { headers } = await authenticateRequest(req);
  return UsersController.updateProfile(withAuthHeaders(req, headers));
});
