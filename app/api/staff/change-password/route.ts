import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { setStaffCookie } from '@/server/src/shared/utils/cookie-utils';
import { staffChangePassword, staffChangePasswordSchema } from '@/server/src/modules/staff/staff-auth';

// POST /api/staff/change-password (also allowed while a temporary password must be replaced)
export const POST = staffApi(null, async (req, { staff, ip }) => {
  const input = staffChangePasswordSchema.parse(await req.json());
  const token = await staffChangePassword(staff.id, input, ip);
  const res = HttpResponse.success({ changed: true }, 'Password changed');
  setStaffCookie(res, token);
  return res;
}, { allowPasswordChange: true });
