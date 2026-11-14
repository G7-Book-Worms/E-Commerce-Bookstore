// Staff manage staff accounts (SCRUM-206): create with a role and employee ID, promote and demote,
// deactivate, force a password reset, and "delete" (which scrubs the account, never removes the
// row). Who may act on whom is decided by lib/staff-permissions' canManage() plus the rule that
// nobody acts on their own row - see staff-guards.ts, which both halves go through.
//
// Guard rails: at least one active administrator always remains, and the single owner can never be
// deleted, demoted or deactivated by anybody.
import { randomBytes } from 'node:crypto';
import { and, asc, eq, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { admin } from '../../../db/schema';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error';
import { hashPassword } from '../../shared/utils/hash-utils';
import { clearFailures } from '../../shared/security/rate-limit';
import { isDuplicateKeyError } from '../auth/auth-service';
import { temporaryPassword } from './staff-auth';
import { sendEmail } from '../email/mailer';
import { temporaryPasswordEmail } from '../email/templates';
import { assignableRoles } from '../../../../lib/staff-permissions';
import {
  ANONYMISED,
  STAFF_ACTIONS,
  anonymisedEmail,
  canActOn,
  staffActionNeedsStepUp,
  type ActorRef,
} from './staff-guards';
import { requireStepUp, stepUpPasswordSchema } from './step-up';

// 'owner' is deliberately not assignable: there is exactly one owner and it is seeded, so no API
// can create or promote one.
const role = z.enum(['admin', 'manager', 'employee']);

export const createStaffSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Enter a valid email').max(100).toLowerCase(),
  employeeId: z.string().trim().toUpperCase().regex(/^BW-\d{4}$/, 'Employee IDs look like BW-1234'),
  role,
});

export const updateStaffSchema = z.object({
  action: z.enum(STAFF_ACTIONS),
  role: role.optional(),
  // Only read for the destructive actions; see staffActionNeedsStepUp().
  actorPassword: stepUpPasswordSchema.optional(),
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

export async function createStaff(actor: ActorRef, input: z.infer<typeof createStaffSchema>) {
  // A manager can open the staff page, so the role being created has to be checked against what
  // this actor may assign - otherwise a manager could create an administrator and promote itself.
  if (!assignableRoles(actor.role).includes(input.role)) {
    throw new ForbiddenError('Your role cannot create an account with that role');
  }
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

/**
 * How many accounts other than `adminId` could still administer staff accounts: active owners and
 * active administrators. The owner counts because it outranks an admin and can do everything on
 * the staff page, so an organisation left with only the owner is still administrable.
 */
async function otherActiveAdministrators(adminId: number) {
  const [row] = await db.select({ n: sql<number>`COUNT(*)` }).from(admin)
    .where(and(
      or(eq(admin.adminRole, 'admin'), eq(admin.adminRole, 'owner')),
      eq(admin.isActive, true),
      ne(admin.adminId, adminId),
    ));
  return Number(row?.n ?? 0);
}

/** A bcrypt hash of random bytes that are then thrown away: no password matches it. */
async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString('base64'));
}

/**
 * "Delete" a staff account. As with customers the row stays: the activity log, inventory
 * movements, ticket replies and answered contact messages all point at this admin id, and removing
 * the row would break those trails (which is exactly the history an audit needs).
 *
 * So the person is removed from it instead: name, email and employee ID go, the role drops to the
 * least privileged one so a scrubbed row can never carry authority, the account is disabled, the
 * password is replaced with one nobody knows, and the token version is bumped to kill any session.
 */
async function anonymiseStaff(targetId: number, previousEmail: string) {
  await db.update(admin).set({
    firstName: ANONYMISED.firstName,
    lastName: ANONYMISED.staffLastName,
    email: anonymisedEmail('staff', targetId),
    employeeId: null,
    adminRole: 'employee',
    passwordHash: await unusablePasswordHash(),
    isActive: false,
    mustChangePassword: false,
    tokenVersion: sql`${admin.tokenVersion} + 1`,
  }).where(eq(admin.adminId, targetId));
  await clearFailures(`staff-login:email:${previousEmail}`);
}

/**
 * Apply one action to one staff account.
 *
 * The order matters, and every step is on the server:
 *   1. the target is read from the database (never trusted from the request);
 *   2. canActOn() checks the role hierarchy AND that these are two different accounts;
 *   3. a role change must be a role this actor is allowed to assign;
 *   4. the owner is refused outright, and the last active administrator is protected;
 *   5. destructive actions re-confirm the actor's own password;
 *   6. only then does anything change.
 *
 * `actor` comes from the staff session, whose role was re-read from the database by
 * authenticateStaff(), so a demoted or deactivated session cannot act with its old role.
 */
export async function updateStaff(
  actor: ActorRef,
  targetId: number,
  input: z.infer<typeof updateStaffSchema>,
  ip?: string | null
) {
  const [target] = await db.select().from(admin).where(eq(admin.adminId, targetId));
  if (!target) throw new NotFoundError('Staff account not found');

  // The owner is stated separately from canActOn(), which also refuses it, because this is the
  // invariant we care about most and it should not depend on one helper staying correct.
  if (target.adminRole === 'owner') {
    throw new ForbiddenError('The owner account cannot be changed');
  }
  if (actor.id === targetId) {
    throw new ForbiddenError("You can't change your own staff account here");
  }
  if (!canActOn(actor, { id: targetId, role: target.adminRole })) {
    throw new ForbiddenError('Your role cannot change that staff account');
  }

  if (input.action === 'set-role') {
    if (!input.role) throw new BadRequestError('Choose a role');
    if (!assignableRoles(actor.role).includes(input.role)) {
      throw new ForbiddenError('Your role cannot assign that role');
    }
    if (input.role === target.adminRole) throw new BadRequestError('That is already their role');
  }

  // Deleting an account demotes and disables it, so it loses administrator rights too.
  const losesAdministrator =
    target.adminRole === 'admin' &&
    ((input.action === 'set-role' && input.role !== 'admin') ||
      input.action === 'deactivate' ||
      input.action === 'delete');
  if (losesAdministrator && (await otherActiveAdministrators(targetId)) === 0) {
    throw new BadRequestError('There must always be at least one active administrator');
  }

  if (staffActionNeedsStepUp(input.action, target.adminRole, input.role)) {
    await requireStepUp(actor.id, input.actorPassword, ip);
  }

  switch (input.action) {
    case 'set-role':
      await db.update(admin).set({ adminRole: input.role! }).where(eq(admin.adminId, targetId));
      return { email: target.email, before: target.adminRole, after: input.role };
    case 'deactivate':
    case 'activate':
      await db.update(admin).set({ isActive: input.action === 'activate', tokenVersion: sql`${admin.tokenVersion} + 1` })
        .where(eq(admin.adminId, targetId));
      return { email: target.email };
    case 'sign-out':
      await db.update(admin).set({ tokenVersion: sql`${admin.tokenVersion} + 1` }).where(eq(admin.adminId, targetId));
      return { email: target.email };
    case 'delete':
      await anonymiseStaff(targetId, target.email);
      return { email: target.email, before: target.adminRole };
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

/** Which rows the staff page may offer actions on, decided server-side for the signed-in actor. */
export function actionableStaffIds(actor: ActorRef, rows: { adminId: number; role: string }[]): number[] {
  return rows.filter((r) => canActOn(actor, { id: r.adminId, role: r.role })).map((r) => r.adminId);
}
