// DELETE /api/passkeys/:id { password } -> removes one of the signed-in customer's passkeys
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { removeHandler } from '@/server/src/modules/passkeys/passkey-handlers';

export const DELETE = createApiHandler(async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
  const { user } = await authenticateRequest(req);
  const params = (await context?.params) ?? {};
  return removeHandler('customer', Number(user.id), params.id, req, clientIp(req));
});
