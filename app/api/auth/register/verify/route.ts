import { NextRequest } from 'next/server';
import { handleRegisterVerify } from '../../../../../server/src/modules/auth/auth-route';

export async function POST(req: NextRequest) {
  return handleRegisterVerify(req);
}
