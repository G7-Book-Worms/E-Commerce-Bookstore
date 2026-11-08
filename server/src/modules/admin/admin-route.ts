import { createApiHandler } from '../../server';
import { AdminController } from './admin-controller';
import { requireRole } from '../../shared/middleware/rbac-middleware';

/**
 * Route guarded by requireRole(['admin']).
 * Non-admins receive 403 Forbidden automatically.
 */
export const GET = createApiHandler(
  requireRole(['admin'])(AdminController.overview)
);