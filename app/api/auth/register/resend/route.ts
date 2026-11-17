import { NextRequest } from 'next/server';
import { handleRegisterResend } from '../../../../../server/src/modules/auth/auth-route';

export async function POST(req: NextRequest) {
  return handleRegisterResend(req);
}
