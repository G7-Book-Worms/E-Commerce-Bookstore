import { NextRequest } from 'next/server';
import { handleGetMe } from '../../../../server/src/modules/auth/auth-route'

export async function GET(req: NextRequest) {
  return handleGetMe(req);
}