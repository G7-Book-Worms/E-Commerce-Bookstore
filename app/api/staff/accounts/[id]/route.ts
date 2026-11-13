import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { updateStaff, updateStaffSchema } from '@/server/src/modules/staff/staff-accounts';

// PATCH /api/staff/accounts/:id { action, role? } (administrators only)
export const PATCH = staffApi('staff.manage', async (req, { params, log, staff }) => {
  const targetId = idParam(params.id);
  const input = updateStaffSchema.parse(await req.json());
  const result = await updateStaff(staff.id, targetId, input);
  const { password, ...details } = result as { password?: string; email: string };
  await log(`staff.${input.action.replace('-', '_')}`, { targetId, ...details });
  return HttpResponse.success(password ? { password } : {}, 'Saved');
});
