// Database-backed rate limits and sign-in lockout (SCRUM-213). Stored in MySQL so the limits hold
// across Vercel's serverless instances (in-memory counters would reset on every cold start).
import { eq, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { rateLimits } from '../../../db/schema';
import { AppError } from '../errors/app-error';

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many attempts. Please wait a few minutes and try again.') {
    super(message, 429);
  }
}

/**
 * Counts one hit for `key`. Throws 429 once more than `limit` hits land inside `windowSeconds`.
 * Example: await rateLimit(`contact:ip:${ip}`, 5, 3600) = five contact messages per hour per IP.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  // One atomic upsert: start a new window when the old one has expired, otherwise add a hit.
  await db
    .insert(rateLimits)
    .values({ rateKey: key, hits: 1, windowStart: sql`CURRENT_TIMESTAMP` })
    .onDuplicateKeyUpdate({
      set: {
        hits: sql`IF(${rateLimits.windowStart} < (CURRENT_TIMESTAMP - INTERVAL ${windowSeconds} SECOND), 1, ${rateLimits.hits} + 1)`,
        windowStart: sql`IF(${rateLimits.windowStart} < (CURRENT_TIMESTAMP - INTERVAL ${windowSeconds} SECOND), CURRENT_TIMESTAMP, ${rateLimits.windowStart})`,
      },
    });
  const [row] = await db.select({ hits: rateLimits.hits }).from(rateLimits).where(eq(rateLimits.rateKey, key));
  if (row && row.hits > limit) throw new TooManyRequestsError();
}

// ---- Sign-in lockout ----
const MAX_FAILURES = 5; // wrong passwords per account...
const FAILURE_WINDOW_SECONDS = 15 * 60; // ...within 15 minutes
const LOCK_SECONDS = 15 * 60; // locks sign-in for that account for 15 minutes

/** Throws 429 while the account is locked. Call before checking the password. */
export async function assertNotLocked(key: string): Promise<void> {
  const [row] = await db
    .select({ lockedUntil: rateLimits.lockedUntil, stillLocked: sql<number>`${rateLimits.lockedUntil} > CURRENT_TIMESTAMP` })
    .from(rateLimits)
    .where(eq(rateLimits.rateKey, key));
  if (row?.lockedUntil && Number(row.stillLocked) === 1) {
    throw new TooManyRequestsError(
      'Too many failed sign-in attempts. This account is locked for 15 minutes. Use "Forgot password?" if you need to reset it.'
    );
  }
}

/** Records a wrong password; locks the account after MAX_FAILURES. Returns true if it just locked. */
export async function recordFailure(key: string): Promise<boolean> {
  await db
    .insert(rateLimits)
    .values({ rateKey: key, hits: 1, windowStart: sql`CURRENT_TIMESTAMP` })
    .onDuplicateKeyUpdate({
      set: {
        hits: sql`IF(${rateLimits.windowStart} < (CURRENT_TIMESTAMP - INTERVAL ${FAILURE_WINDOW_SECONDS} SECOND), 1, ${rateLimits.hits} + 1)`,
        windowStart: sql`IF(${rateLimits.windowStart} < (CURRENT_TIMESTAMP - INTERVAL ${FAILURE_WINDOW_SECONDS} SECOND), CURRENT_TIMESTAMP, ${rateLimits.windowStart})`,
      },
    });
  const [row] = await db.select({ hits: rateLimits.hits }).from(rateLimits).where(eq(rateLimits.rateKey, key));
  if (row && row.hits >= MAX_FAILURES) {
    await db
      .update(rateLimits)
      .set({ lockedUntil: sql`CURRENT_TIMESTAMP + INTERVAL ${LOCK_SECONDS} SECOND`, hits: 0 })
      .where(eq(rateLimits.rateKey, key));
    return true;
  }
  return false;
}

/** Successful sign-in or password reset: forget earlier failures and any lock. */
export async function clearFailures(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.rateKey, key));
}
