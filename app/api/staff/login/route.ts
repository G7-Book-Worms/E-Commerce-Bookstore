import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { setStaffCookie } from '@/server/src/shared/utils/cookie-utils';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { staffLogin, staffLoginSchema } from '@/server/src/modules/staff/staff-auth';

// POST /api/staff/login { email, password, employeeId }
export const POST = createApiHandler(async (req: NextRequest) => {
  const input = staffLoginSchema.parse(await req.json());
  const { token, mustChangePassword } = await staffLogin(input, clientIp(req));
  const res = HttpResponse.success({ mustChangePassword }, 'Signed in');
  setStaffCookie(res, token);
  return res;
});
