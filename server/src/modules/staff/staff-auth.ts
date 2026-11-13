// Staff portal sign-in (SCRUM-187/206/213): email + password + employee ID, the same lockout
// and rate limits as customers, a separate 8-hour session cookie, and forced password change
// after an administrator sets a temporary password.
import { randomInt } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { admin } from '../../../db/schema';
import { burnHashTime, comparePassword, hashPassword, needsRehash } from '../../shared/utils/hash-utils';
import { generateToken, type StaffRole } from '../../shared/utils/token-util';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error';
import { assertNotLocked, clearFailures, rateLimit, recordFailure } from '../../shared/security/rate-limit';
import { logActivity } from '../activity/activity-log';
import { newPasswordSchema } from '../../../../lib/password-policy';

export const staffLoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required').max(200),
  employeeId: z.string().trim().min(1, 'Employee ID is required').max(20).toUpperCase(),
});

export const staffChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export function staffToken(a: { adminId: number; email: string; adminRole: string; tokenVersion: number }) {
  return generateToken({ id: a.adminId, email: a.email, role: a.adminRole as StaffRole, tv: a.tokenVersion }, 'staff');
}

const GENERIC = 'Invalid email, password or employee ID';

export async function staffLogin(input: z.infer<typeof staffLoginSchema>, ip: string) {
  await rateLimit(`staff-login:ip:${ip}`, 20, 15 * 60);
  const lockKey = `staff-login:email:${input.email}`;
  await assertNotLocked(lockKey);

  const [account] = await db.select().from(admin).where(eq(admin.email, input.email));
  if (!account) {
    await burnHashTime(input.password);
    await recordFailure(lockKey);
    throw new UnauthorizedError(GENERIC);
  }
  const passwordOk = await comparePassword(input.password, account.passwordHash);
  if (!passwordOk || (account.employeeId ?? '').toUpperCase() !== input.employeeId) {
    const locked = await recordFailure(lockKey);
    await logActivity('admin', account.adminId, locked ? 'staff.locked_out' : 'staff.login_failed', {}, ip);
    throw new UnauthorizedError(GENERIC);
  }
  if (!account.isActive) throw new UnauthorizedError('This staff account has been deactivated');

  await clearFailures(lockKey);
  await db.update(admin).set({
    lastLogin: new Date(),
    ...(needsRehash(account.passwordHash) ? { passwordHash: await hashPassword(input.password) } : {}),
  }).where(eq(admin.adminId, account.adminId));
  await logActivity('admin', account.adminId, 'staff.login', {}, ip);
  return { token: staffToken(account), mustChangePassword: account.mustChangePassword };
}

export async function staffChangePassword(staffId: number, input: z.infer<typeof staffChangePasswordSchema>, ip: string) {
  await rateLimit(`staff-change-password:${staffId}`, 10, 15 * 60);
  const [account] = await db.select().from(admin).where(eq(admin.adminId, staffId));
  if (!account) throw new UnauthorizedError('Please sign in again');
  if (!(await comparePassword(input.currentPassword, account.passwordHash))) {
    throw new UnauthorizedError('Current password is incorrect');
  }
  if (input.newPassword === input.currentPassword) throw new BadRequestError('Choose a different password');
  await db.update(admin).set({
    passwordHash: await hashPassword(input.newPassword),
    mustChangePassword: false,
    tokenVersion: sql`${admin.tokenVersion} + 1`,
  }).where(eq(admin.adminId, staffId));
  const [updated] = await db.select().from(admin).where(eq(admin.adminId, staffId));
  await logActivity('admin', staffId, 'staff.password_changed', {}, ip);
  return staffToken(updated!);
}

/**
 * A readable temporary password that passes the password policy, e.g. "Maple-Otter-4821!".
 * Shown once to the staff member who set it; only the bcrypt hash is stored.
 */
const WORDS = ['Maple', 'Otter', 'Cedar', 'Harbor', 'Quill', 'Lantern', 'Meadow', 'Falcon', 'Willow', 'Ember', 'Pebble', 'Comet', 'Thistle', 'Marble', 'Juniper', 'Sparrow'];
export function temporaryPassword(): string {
  const w = () => WORDS[randomInt(WORDS.length)];
  return `${w()}-${w()}-${randomInt(1000, 10000)}!`;
}

export async function findStaffByEmployeeOrEmail(email: string, employeeId: string) {
  const [row] = await db.select({ adminId: admin.adminId }).from(admin)
    .where(and(eq(admin.email, email), eq(admin.employeeId, employeeId)));
  return row;
}
