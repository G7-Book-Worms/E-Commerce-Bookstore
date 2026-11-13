import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { createStaff, createStaffSchema } from '@/server/src/modules/staff/staff-accounts';

// POST /api/staff/accounts (administrators only)
export const POST = staffApi('staff.manage', async (req, { log }) => {
  const input = createStaffSchema.parse(await req.json());
  const { password } = await createStaff(input);
  await log('staff.created', { email: input.email, employeeId: input.employeeId, role: input.role });
  return HttpResponse.created({ password }, 'Staff account created');
});
