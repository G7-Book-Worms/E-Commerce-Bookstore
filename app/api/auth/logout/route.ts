import { NextRequest } from 'next/server';
import { handleLogout } from '../../../../server/src/modules/auth/auth-route';

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
