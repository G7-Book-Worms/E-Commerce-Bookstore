// GET  /api/passkeys -> { passkeys: [...] } for the signed-in customer
// POST /api/passkeys { step: 'options' } -> WebAuthn options (and a short-lived challenge cookie)
// POST /api/passkeys { step: 'add', response, name?, password } -> saves the new passkey
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { addHandler, listHandler } from '@/server/src/modules/passkeys/passkey-handlers';

export const GET = createApiHandler(async (req: NextRequest) => {
  const { user } = await authenticateRequest(req);
  return listHandler('customer', Number(user.id));
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const { user } = await authenticateRequest(req);
  return addHandler('customer', Number(user.id), req, clientIp(req));
});
