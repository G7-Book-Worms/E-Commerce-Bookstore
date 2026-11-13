import { NextRequest } from 'next/server';
import { createApiHandler } from '../../../../server/src/server';
import { UsersController } from '../../../../server/src/modules/users/users-controller';
import { authenticateRequest, withAuthHeaders } from '../../../../server/src/shared/middleware/auth-middleware';

export const POST = createApiHandler(async (req: NextRequest) => {
  const { headers } = await authenticateRequest(req);
  return UsersController.changePassword(withAuthHeaders(req, headers));
});