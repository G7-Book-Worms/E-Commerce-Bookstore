// GET  /api/staff/mfa -> { method: 'email' | 'totp', required: true }
// POST /api/staff/mfa { action, ... } -> switch between emailed codes and an authenticator app.
// Any signed-in staff member manages their own; it can't be turned off.
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { changeMfaSettings, mfaSettingsSchema, mfaStatus } from '@/server/src/modules/mfa/mfa-service';

export const GET = staffApi(null, async (_req, { staff }) =>
  HttpResponse.success(await mfaStatus('staff', staff.id), 'Two-step sign-in settings'));

export const POST = staffApi(null, async (req, { staff, ip }) => {
  const input = mfaSettingsSchema.parse(await req.json());
  return HttpResponse.success(await changeMfaSettings('staff', staff.id, input, ip), 'Saved');
});
