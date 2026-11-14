import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { updateStaff, updateStaffSchema } from '@/server/src/modules/staff/staff-accounts';

/**
 * PATCH /api/staff/accounts/:id { action, role?, actorPassword? }
 *
 * staff.manage opens this route; it does not say which accounts the role may touch. That decision,
 * the owner and last-administrator guard rails, and the password re-confirmation all live in
 * updateStaff(), which reads the target from the database - so nothing the client sends about the
 * target or about its own role is trusted here.
 */
export const PATCH = staffApi('staff.manage', async (req, { params, log, staff, ip }) => {
  const targetId = idParam(params.id);
  const input = updateStaffSchema.parse(await req.json());
  const result = await updateStaff({ id: staff.id, role: staff.role }, targetId, input, ip);
  const { password, ...details } = (result ?? {}) as Record<string, unknown> & { password?: string };
  // "delete" is recorded as what it really is, so the log does not suggest the row was removed.
  const action = input.action === 'delete' ? 'anonymised' : input.action.replace('-', '_');
  await log(`staff.${action}`, { actorId: staff.id, targetId, ...details });
  return HttpResponse.success(password ? { password } : {}, 'Saved');
});
