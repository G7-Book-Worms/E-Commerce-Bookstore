import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clearStaffCookie } from '@/server/src/shared/utils/cookie-utils';
import { staffChangePassword, staffChangePasswordSchema } from '@/server/src/modules/staff/staff-auth';

// POST /api/staff/change-password (also allowed while a temporary password must be replaced).
// Changing the password signs out every staff session for this account, this browser included,
// so the cookie is cleared here and the form sends them to the sign-in page.
export const POST = staffApi(null, async (req, { staff, ip }) => {
  const input = staffChangePasswordSchema.parse(await req.json());
  await staffChangePassword(staff.id, input, ip);
  const res = HttpResponse.success({ changed: true, signedOut: true }, 'Password changed. Sign in again with your new password.');
  clearStaffCookie(res);
  return res;
}, { allowPasswordChange: true });
