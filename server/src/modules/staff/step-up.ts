// Step-up authentication for destructive staff-portal actions (deactivate, delete, force a
// password reset, demote). Being signed in is not enough for these: the acting staff member types
// their own password again and it is checked here, on the server, against their stored bcrypt hash.
//
// It exists because a staff workstation is often left unlocked and the staff portal session lasts
// eight hours. Re-asking turns "anyone who walks past this laptop" into "anyone who knows this
// person's password".
//
// Rules this file keeps:
//   - the password is compared with bcrypt against the actor's own stored hash, never anything the
//     client sent about who they are;
//   - attempts are rate-limited per actor through the shared database-backed limiter, so the
//     confirmation box cannot be used as a password-guessing oracle;
//   - the password is never logged, never put in an activity-log detail, and never returned;
//   - it fails closed: a missing or malformed password, an account that has gone away, or any
//     error at all throws before the caller's mutation runs.
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { admin } from '../../../db/schema';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { comparePassword } from '../../shared/utils/hash-utils';
import { rateLimit } from '../../shared/security/rate-limit';
import { logActivity } from '../activity/activity-log';

/** Ten confirmations per quarter of an hour: plenty for real work, useless for guessing. */
export const STEP_UP_LIMIT = 10;
export const STEP_UP_WINDOW_SECONDS = 15 * 60;

export function stepUpKey(actorId: number): string {
  return `step-up:staff:${actorId}`;
}

/**
 * The field a client sends alongside a destructive action. Not newPasswordSchema: this is an
 * existing password being confirmed, and it must not be measured against the current policy
 * (an older password that no longer satisfies it still has to work).
 */
export const stepUpPasswordSchema = z
  .string({ required_error: 'Confirm your password to continue' })
  .min(1, 'Confirm your password to continue')
  .max(200, 'Confirm your password to continue');

const WRONG = 'That password is not correct. The action was not carried out.';

/**
 * Throws unless `password` is the current password of staff account `actorId`.
 * Call it before doing anything destructive, and let it throw.
 */
export async function requireStepUp(actorId: number, password: unknown, ip?: string | null): Promise<void> {
  const parsed = stepUpPasswordSchema.safeParse(password);
  if (!parsed.success) throw new UnauthorizedError(parsed.error.issues[0]?.message ?? WRONG);

  // Counted before the comparison, so a wrong guess costs an attempt even if the request
  // then fails for another reason. Throws 429 once the window is used up.
  await rateLimit(stepUpKey(actorId), STEP_UP_LIMIT, STEP_UP_WINDOW_SECONDS);

  const [account] = await db
    .select({ passwordHash: admin.passwordHash, isActive: admin.isActive })
    .from(admin)
    .where(eq(admin.adminId, actorId));
  // No row, or an account deactivated since the session was issued: refuse rather than assume.
  if (!account || !account.isActive) throw new UnauthorizedError('Your staff session has ended. Please sign in again.');

  if (!(await comparePassword(parsed.data, account.passwordHash))) {
    // The attempt is recorded; the password itself is not part of the details.
    await logActivity('admin', actorId, 'staff.step_up_failed', {}, ip);
    throw new UnauthorizedError(WRONG);
  }
}
