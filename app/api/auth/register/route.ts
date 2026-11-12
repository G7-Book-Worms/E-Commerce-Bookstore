import { NextRequest } from 'next/server';
import { handleRegister } from '../../../../server/src/modules/auth/auth-route';

export async function POST(req: NextRequest) {
  return handleRegister(req);
}
