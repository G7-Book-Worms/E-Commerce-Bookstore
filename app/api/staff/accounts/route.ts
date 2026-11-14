import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { createStaff, createStaffSchema } from '@/server/src/modules/staff/staff-accounts';

// POST /api/staff/accounts. staff.manage opens the route; createStaff() then checks that the role
// being created is one this actor may assign, so a manager cannot create an administrator.
export const POST = staffApi('staff.manage', async (req, { log, staff }) => {
  const input = createStaffSchema.parse(await req.json());
  const { password } = await createStaff({ id: staff.id, role: staff.role }, input);
  await log('staff.created', { actorId: staff.id, email: input.email, employeeId: input.employeeId, role: input.role });
  return HttpResponse.created({ password }, 'Staff account created');
});
