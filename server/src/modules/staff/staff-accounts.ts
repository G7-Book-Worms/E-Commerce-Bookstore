// Administrators manage staff accounts (SCRUM-206): create with a role and employee ID,
// change role, deactivate, and reset passwords. Guard rails keep at least one active admin.
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { admin } from '../../../db/schema';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { hashPassword } from '../../shared/utils/hash-utils';
import { clearFailures } from '../../shared/security/rate-limit';
import { isDuplicateKeyError } from '../auth/auth-service';
import { temporaryPassword } from './staff-auth';
import { sendEmail } from '../email/mailer';
import { temporaryPasswordEmail } from '../email/templates';

const role = z.enum(['admin', 'manager', 'employee']);

export const createStaffSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Enter a valid email').max(100).toLowerCase(),
  employeeId: z.string().trim().toUpperCase().regex(/^BW-\d{4}$/, 'Employee IDs look like BW-1234'),
  role,
});

export const updateStaffSchema = z.object({
  action: z.enum(['set-role', 'deactivate', 'activate', 'temp-password', 'sign-out']),
  role: role.optional(),
});

export async function listStaff() {
  return db
    .select({
      adminId: admin.adminId,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      employeeId: admin.employeeId,
      role: admin.adminRole,
      isActive: admin.isActive,
      mustChangePassword: admin.mustChangePassword,
      lastLogin: admin.lastLogin,
      created: admin.created,
    })
    .from(admin)
    .orderBy(asc(admin.lastName));
}

export async function nextEmployeeId(): Promise<string> {
  const [row] = await db.select({ max: sql<string | null>`MAX(${admin.employeeId})` }).from(admin);
  const n = Number(row?.max?.replace(/\D/g, '') || 1000) + 1;
  return `BW-${n}`;
}

export async function createStaff(input: z.infer<typeof createStaffSchema>) {
  const password = temporaryPassword();
  try {
    await db.insert(admin).values({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      employeeId: input.employeeId,
      adminRole: input.role,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ConflictError('That email or employee ID is already used by another staff account');
    throw err;
  }
  return { password };
}

async function activeAdminsExcept(adminId: number) {
  const [row] = await db.select({ n: sql<number>`COUNT(*)` }).from(admin)
    .where(and(eq(admin.adminRole, 'admin'), eq(admin.isActive, true), ne(admin.adminId, adminId)));
  return Number(row?.n ?? 0);
}

export async function updateStaff(actorId: number, targetId: number, input: z.infer<typeof updateStaffSchema>) {
  const [target] = await db.select().from(admin).where(eq(admin.adminId, targetId));
  if (!target) throw new NotFoundError('Staff account not found');
  const isSelf = actorId === targetId;
  const losesAdmin =
    target.adminRole === 'admin' &&
    ((input.action === 'set-role' && input.role !== 'admin') || input.action === 'deactivate');
  if (isSelf && (input.action === 'deactivate' || input.action === 'set-role')) {
    throw new BadRequestError("You can't change your own role or deactivate yourself");
  }
  if (losesAdmin && (await activeAdminsExcept(targetId)) === 0) {
    throw new BadRequestError('There must always be at least one active administrator');
  }

  switch (input.action) {
    case 'set-role':
      if (!input.role) throw new BadRequestError('Choose a role');
      await db.update(admin).set({ adminRole: input.role }).where(eq(admin.adminId, targetId));
      return { email: target.email, before: target.adminRole, after: input.role };
    case 'deactivate':
    case 'activate':
      await db.update(admin).set({ isActive: input.action === 'activate', tokenVersion: sql`${admin.tokenVersion} + 1` })
        .where(eq(admin.adminId, targetId));
      return { email: target.email };
    case 'sign-out':
      await db.update(admin).set({ tokenVersion: sql`${admin.tokenVersion} + 1` }).where(eq(admin.adminId, targetId));
      return { email: target.email };
    case 'temp-password': {
      const password = temporaryPassword();
      await db.update(admin).set({
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        tokenVersion: sql`${admin.tokenVersion} + 1`,
      }).where(eq(admin.adminId, targetId));
      await clearFailures(`staff-login:email:${target.email}`);
      await sendEmail(temporaryPasswordEmail(target.email, target.firstName, 'staff'));
      return { email: target.email, password };
    }
  }
}
