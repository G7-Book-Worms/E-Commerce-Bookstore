// GET  /api/users/mfa -> { method: 'none' | 'email' | 'totp' }
// POST /api/users/mfa { action, ... } -> turn two-step sign-in on/off or change method
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { changeMfaSettings, mfaSettingsSchema, mfaStatus } from '@/server/src/modules/mfa/mfa-service';

export const GET = createApiHandler(async (req: NextRequest) => {
  const { user } = await authenticateRequest(req);
  return HttpResponse.success(await mfaStatus('customer', Number(user.id)), 'Two-step sign-in settings');
});

export const POST = createApiHandler(async (req: NextRequest) => {
  const { user } = await authenticateRequest(req);
  const input = mfaSettingsSchema.parse(await req.json());
  return HttpResponse.success(await changeMfaSettings('customer', Number(user.id), input, clientIp(req)), 'Saved');
});
