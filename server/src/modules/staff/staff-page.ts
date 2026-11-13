// For staff portal pages (server components): who is signed in, and are they allowed here?
// Same checks as the API (database-backed), so a stale or demoted session can't see a page.
import 'server-only';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { admin } from '../../../db/schema';
import { verifyToken, type StaffRole } from '../../shared/utils/token-util';
import { STAFF_COOKIE_NAME } from '../../shared/utils/cookie-utils';
import { can, type Permission } from '../../../../lib/staff-permissions';
import type { StaffSession } from '../../shared/middleware/auth-middleware';

export async function getStaffSession(): Promise<StaffSession | null> {
  // Always rendered per request (token expiry checks read the clock)
  await connection();
  const token = (await cookies()).get(STAFF_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = verifyToken(token, 'staff');
    const [a] = await db.select().from(admin).where(eq(admin.adminId, payload.id));
    if (!a || !a.isActive || a.tokenVersion !== (payload.tv ?? 0)) return null;
    return {
      id: a.adminId,
      email: a.email,
      role: a.adminRole as StaffRole,
      firstName: a.firstName,
      lastName: a.lastName,
      mustChangePassword: a.mustChangePassword,
    };
  } catch {
    return null;
  }
}

/** Use at the top of every staff page. Redirects instead of rendering when not allowed. */
export async function requireStaffPage(permission: Permission): Promise<StaffSession> {
  const staff = await getStaffSession();
  if (!staff) redirect('/staff-login');
  if (staff.mustChangePassword) redirect('/admin/change-password');
  if (!can(staff.role, permission)) redirect('/admin?denied=1');
  return staff;
}
