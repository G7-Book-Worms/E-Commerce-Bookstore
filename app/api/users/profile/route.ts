import { NextRequest } from 'next/server';
import { createApiHandler } from '../../../../server/src/server';
import { UsersController } from '../../../../server/src/modules/users/users-controller';
import { authenticateRequest } from '../../../../server/src/shared/middleware/auth-middleware';

export async function GET(req: NextRequest) {
  try {
    const { headers } = authenticateRequest(req);
    const mutatedReq = new NextRequest(req.url, { headers });
    return await UsersController.getProfile(mutatedReq);
  } catch (error: any) {
    return Response.json(
      { status: 'error', message: error.message || 'Unauthorized' },
      { status: error.statusCode || 401 }
    );
  }
}

export const PATCH = createApiHandler(async (req: NextRequest) => {
  const { headers } = authenticateRequest(req);
  return UsersController.updateProfile(new NextRequest(req.url, { headers, body: req.body }));
});