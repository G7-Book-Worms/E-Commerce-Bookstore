import { NextResponse } from 'next/server';
import { clearAuthCookie } from '../../../../server/src/shared/utils/cookie-utils';

export async function POST() {
const response = NextResponse.json({
    status: 'success',
    message: 'Logged out successfully',
  });

  // Expire the authentication cookie
  clearAuthCookie(response);
  return response;
}