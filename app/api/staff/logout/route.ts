import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clearStaffCookie } from '@/server/src/shared/utils/cookie-utils';

// POST /api/staff/logout
export const POST = createApiHandler(async () => {
  const res = HttpResponse.success({ loggedOut: true }, 'Signed out');
  clearStaffCookie(res);
  return res;
});
