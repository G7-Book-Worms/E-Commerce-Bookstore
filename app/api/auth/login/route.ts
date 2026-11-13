import { NextRequest } from 'next/server';
import { handleLogin } from '../../../../server/src/modules/auth/auth-route';

export async function POST(req: NextRequest) {
  return handleLogin(req);
}