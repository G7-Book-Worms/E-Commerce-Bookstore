// server/src/shared/middleware/auth-middleware.ts
// Every signed-in API request goes through one of these two functions.
// Besides checking the JWT they load the account, so a deactivated account or an old token
// (password changed, "sign out everywhere") stops working immediately (SCRUM-213).
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { admin, users } from '../../../db/schema';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error';
import { verifyToken, type JwtPayload, type StaffRole } from '../utils/token-util';
import { AUTH_COOKIE_NAME, STAFF_COOKIE_NAME } from '../utils/cookie-utils';
import { can, type Permission } from '../../../../lib/staff-permissions';

/** Customer requests: reads the auth_token cookie. Throws 401 when signed out or the token is stale. */
export async function authenticateRequest(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) throw new UnauthorizedError('Authentication token is missing');

  const payload = verifyToken(token, 'customer');
  if (!payload?.id || payload.role !== 'customer') {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }

  const [account] = await db
    .select({ isActive: users.isActive, tokenVersion: users.tokenVersion, mustChangePassword: users.mustChangePassword })
    .from(users)
    .where(eq(users.userId, payload.id));
  if (!account || !account.isActive || account.tokenVersion !== (payload.tv ?? 0)) {
    throw new UnauthorizedError('Your session has ended. Please sign in again.');
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id', String(payload.id));
  requestHeaders.set('x-user-email', payload.email || '');
  requestHeaders.set('x-user-role', 'customer');
  requestHeaders.set('x-user-remember', payload.rem ? 'true' : 'false');

  return { headers: requestHeaders, user: payload, mustChangePassword: account.mustChangePassword };
}

export interface StaffSession {
  id: number;
  email: string;
  role: StaffRole;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
}

/**
 * Staff portal requests: reads the staff_token cookie and checks the role's permission.
 * 401 = not signed in as staff; 403 = signed in but the role isn't allowed.
 * Staff who must change a temporary password can only call the change-password API.
 */
export async function authenticateStaff(
  req: NextRequest,
  permission: Permission | null,
  options: { allowPasswordChange?: boolean } = {}
): Promise<StaffSession> {
  const token = req.cookies.get(STAFF_COOKIE_NAME)?.value;
  if (!token) throw new UnauthorizedError('Please sign in to the staff portal');
  const payload: JwtPayload = verifyToken(token, 'staff');

  const [account] = await db.select().from(admin).where(eq(admin.adminId, payload.id));
  if (!account || !account.isActive || account.tokenVersion !== (payload.tv ?? 0)) {
    throw new UnauthorizedError('Your staff session has ended. Please sign in again.');
  }
  // The role comes from the database, not the token, so a demotion takes effect at once
  const role = account.adminRole as StaffRole;
  if (account.mustChangePassword && !options.allowPasswordChange) {
    throw new ForbiddenError('Choose a new password before using the portal');
  }
  if (permission && !can(role, permission)) {
    throw new ForbiddenError('Your role does not have permission to do that');
  }
  return {
    id: account.adminId,
    email: account.email,
    role,
    firstName: account.firstName,
    lastName: account.lastName,
    mustChangePassword: account.mustChangePassword,
  };
}

/**
 * Copy a request and add the authenticated user's headers (x-user-id, x-user-role, ...).
 * Method and body are passed explicitly: `new NextRequest(url, { headers })` alone turns a
 * POST/PATCH into a body-less GET.
 */
export function withAuthHeaders(req: NextRequest, headers: Headers): NextRequest {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  return new NextRequest(req.url, {
    method: req.method,
    headers,
    ...(hasBody ? { body: req.body, duplex: 'half' } : {}),
  } as ConstructorParameters<typeof NextRequest>[1]);
}
