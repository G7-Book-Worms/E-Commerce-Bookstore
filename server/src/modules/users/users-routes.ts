import { createApiHandler } from '../../server';
import { UsersController } from './users-controller';

export const GET = createApiHandler(async (req) => {
  return UsersController.getProfile(req);
});