// "Didn't ask us to unlock your account? Lock it again." The account-unlocked email carries a
// signed link (7 days). Using it locks sign-in again for 7 days, signs the account out on every
// device and opens a support ticket, so staff can help the owner secure the account. The owner
// can still get back in at any time with "Forgot password?": a password reset ends the lock,
// which is also the advice in every lockout email.
import { eq, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { admin, rateLimits, users } from '../../../db/schema';
import { BadRequestError } from '../../shared/errors/app-error';
import { BAD_RELOCK_LINK, RELOCK_LINK_DAYS, readRelockToken, relockUsedKey, relockVoidKey } from './relock-token';
import { isDuplicateKeyError } from './auth-service';
import { signInLockKeys } from '../../shared/security/lock-keys';
import { rateLimit } from '../../shared/security/rate-limit';
import { deleteAllPasskeys } from '../passkeys/passkey-service';
import { logActivity } from '../activity/activity-log';
import { createTicketFromContactForm } from '../tickets/ticket-service';

const RELOCK_SECONDS = 7 * 24 * 60 * 60;

/** Locks the account again (7 days), signs it out everywhere and opens a ticket. */
export async function relockAccount(token: unknown, ip: string | null): Promise<{ ticketNumber: number; kind: 'customer' | 'staff' }> {
  const { kind, id, jti, iat, exp } = readRelockToken(token);
  const [account] = kind === 'customer'
    ? await db.select({ email: users.email, first: users.firstName, last: users.lastName }).from(users).where(eq(users.userId, id))
    : await db.select({ email: admin.email, first: admin.firstName, last: admin.lastName }).from(admin).where(eq(admin.adminId, id));
  if (!account) throw new BadRequestError(BAD_RELOCK_LINK);
  // The owner reset their password after this link was sent: it no longer applies
  const [voided] = await db.select({ at: rateLimits.windowStart }).from(rateLimits).where(eq(rateLimits.rateKey, relockVoidKey(kind, id)));
  if (voided?.at && new Date(voided.at).getTime() >= iat * 1000) throw new BadRequestError(BAD_RELOCK_LINK);
  // At most twice a day per account, wherever the requests come from
  await rateLimit(`relock:acct:${kind}:${id}`, 2, 24 * 60 * 60);
  // Single use, atomically: the first request records the link's id; a second (even at the same
  // moment) hits the unique key and is refused
  try {
    await db.insert(rateLimits).values({
      rateKey: relockUsedKey(jti), hits: 1, windowStart: sql`CURRENT_TIMESTAMP`, lockedUntil: sql`FROM_UNIXTIME(${exp})`,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new BadRequestError(BAD_RELOCK_LINK);
    throw err;
  }

  // Lock both sign-in steps (password and code) for 7 days...
  for (const key of signInLockKeys(kind, id, account.email)) {
    await db.insert(rateLimits)
      .values({ rateKey: key, hits: 0, windowStart: sql`CURRENT_TIMESTAMP`, lockedUntil: sql`CURRENT_TIMESTAMP + INTERVAL ${RELOCK_SECONDS} SECOND` })
      .onDuplicateKeyUpdate({ set: { hits: 0, lockedUntil: sql`CURRENT_TIMESTAMP + INTERVAL ${RELOCK_SECONDS} SECOND` } });
  }
  // Passkeys go too: one an intruder added would otherwise still get in. The owner can add
  // theirs again after resetting the password.
  await deleteAllPasskeys(kind, id);
  // ...and end every session, wherever it is
  if (kind === 'customer') await db.update(users).set({ tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.userId, id));
  else await db.update(admin).set({ tokenVersion: sql`${admin.tokenVersion} + 1` }).where(eq(admin.adminId, id));

  const { number } = await createTicketFromContactForm({
    name: `${account.first} ${account.last}`.trim() || 'Book Worms customer',
    email: account.email,
    subject: 'Account locked by owner after an unexpected unlock',
    message: `The account owner used the "Lock My Account" link in the account-unlocked email. They did not ask for the unlock. `
      + `Sign-in is locked for ${RELOCK_LINK_DAYS} days and every session was ended. Contact them to help secure the account `
      + `(a password reset by the owner also ends the lock).`,
    website: '',
  }, kind === 'customer' ? id : null);
  await logActivity(kind === 'customer' ? 'customer' : 'admin', id, 'security.relocked_by_owner', { ticketNumber: number }, ip);
  return { ticketNumber: number, kind };
}
