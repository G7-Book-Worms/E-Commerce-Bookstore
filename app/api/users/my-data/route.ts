// GET    /api/users/my-data -> a JSON file with everything stored about the signed-in customer
// DELETE /api/users/my-data { password, confirm: "DELETE" } -> deletes (anonymises) the account
// SCRUM-216. See server/src/modules/users/privacy-service.ts.
import { NextRequest, NextResponse } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clearAuthCookie } from '@/server/src/shared/utils/cookie-utils';
import { deleteAccountSchema, deleteOwnAccount, exportCustomerData } from '@/server/src/modules/users/privacy-service';

export const GET = createApiHandler(async (req: NextRequest) => {
  const { user } = await authenticateRequest(req);
  const { data, fileName } = await exportCustomerData(Number(user.id), clientIp(req));
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});

export const DELETE = createApiHandler(async (req: NextRequest) => {
  const { user } = await authenticateRequest(req);
  const input = deleteAccountSchema.parse(await req.json());
  await deleteOwnAccount(Number(user.id), input, clientIp(req));
  const res = HttpResponse.success({ deleted: true }, 'Your account was deleted');
  clearAuthCookie(res);
  return res;
});
