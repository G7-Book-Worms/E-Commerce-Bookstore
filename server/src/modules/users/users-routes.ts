import { createApiHandler } from '../../server';
import { UsersController } from './users-controller';

export const GET = createApiHandler(async (req) => {
  const userId = req.headers.get('x-user-id') || '';
  return UsersController.getProfile(req, userId);
});