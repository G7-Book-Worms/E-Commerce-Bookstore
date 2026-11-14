// Staff management of customer accounts (SCRUM-200): search, view, deactivate/reactivate,
// set a temporary password, sign the customer out of every device, and - new in v2 - multi-select
// bulk actions and "delete", which scrubs the account instead of removing the row.
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { addresses, orders, users } from '../../../db/schema';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { AuthService, isDuplicateKeyError } from '../auth/auth-service';
import { hashPassword } from '../../shared/utils/hash-utils';
import { clearFailures } from '../../shared/security/rate-limit';
import { isPlacedOrder } from '../orders/placed-orders';
import { temporaryPassword } from '../staff/staff-auth';
import { sendEmail } from '../email/mailer';
import { temporaryPasswordEmail } from '../email/templates';
import { ANONYMISED, anonymisedEmail, isAnonymised, type BulkOutcome } from '../staff/staff-guards';

export type CustomerSort = 'name' | 'joined' | 'orders' | 'spent';

const placedOrders = sql`(SELECT COUNT(*) FROM orders o WHERE o.user_id = ${users.userId} AND NOT EXISTS (
  SELECT 1 FROM payments p WHERE p.order_id = o.order_id AND p.card_provider = 'stripe' AND p.status IN ('pending','processing','failed','cancelled')))`;
const spent = sql`(SELECT COALESCE(SUM(o.price_cents), 0) FROM orders o WHERE o.user_id = ${users.userId} AND o.status <> 'cancelled' AND NOT EXISTS (
  SELECT 1 FROM payments p WHERE p.order_id = o.order_id AND p.card_provider = 'stripe' AND p.status IN ('pending','processing','failed','cancelled')))`;

export async function listCustomers(opts: { q?: string; status?: 'active' | 'inactive'; sort?: CustomerSort; dir?: 'asc' | 'desc' }) {
  const conds = [];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(sql`(${users.email} LIKE ${like} OR CONCAT(${users.firstName}, ' ', ${users.lastName}) LIKE ${like} OR ${users.phone} LIKE ${like})`);
  }
  if (opts.status === 'active') conds.push(eq(users.isActive, true));
  if (opts.status === 'inactive') conds.push(eq(users.isActive, false));
  const dir = opts.dir === 'asc' ? asc : desc;
  const orderBy =
    opts.sort === 'name' ? [dir(users.lastName), dir(users.firstName)]
    : opts.sort === 'orders' ? [dir(placedOrders), desc(users.userId)]
    : opts.sort === 'spent' ? [dir(spent), desc(users.userId)]
    : [dir(users.created), dir(users.userId)];
  const rows = await db
    .select({
      userId: users.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      created: users.created,
      orderCount: sql<number>`${placedOrders}`,
      spentCents: sql<number>`${spent}`,
    })
    .from(users)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...orderBy)
    .limit(200);
  return rows.map((r) => ({
    ...r,
    orderCount: Number(r.orderCount),
    spentCents: Number(r.spentCents),
    // Already scrubbed by a delete: there is nothing left to act on, and no details to show.
    anonymised: isAnonymised(r.email),
  }));
}

export async function getCustomer(userId: number) {
  const [user] = await db
    .select({
      userId: users.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      created: users.created,
      updated: users.updated,
    })
    .from(users)
    .where(eq(users.userId, userId));
  if (!user) throw new NotFoundError('Customer not found');
  const [addressRows, orderRows] = await Promise.all([
    db.select().from(addresses).where(eq(addresses.userId, userId)),
    db.select({ orderId: orders.orderId, created: orders.created, status: orders.status, totalCents: orders.priceCents })
      .from(orders).where(and(eq(orders.userId, userId), isPlacedOrder)).orderBy(desc(orders.created)).limit(50),
  ]);
  return { user, addresses: addressRows, orders: orderRows };
}

async function mustExist(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.userId, userId));
  if (!u) throw new NotFoundError('Customer not found');
  return u;
}

/** Deactivating also signs the customer out everywhere (token version bump). */
export async function setCustomerActive(userId: number, active: boolean) {
  const u = await mustExist(userId);
  await db.update(users).set({ isActive: active, tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.userId, userId));
  return { email: u.email };
}

export async function signOutCustomerEverywhere(userId: number) {
  const u = await mustExist(userId);
  await db.update(users).set({ tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.userId, userId));
  return { email: u.email };
}

/**
 * Returns a new temporary password (shown once to the staff member). The customer must choose a
 * new password at the next sign-in, every existing session is signed out, and any lockout is cleared.
 */
export async function setCustomerTemporaryPassword(userId: number) {
  const u = await mustExist(userId);
  const password = temporaryPassword();
  await db.update(users).set({
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    tokenVersion: sql`${users.tokenVersion} + 1`,
  }).where(eq(users.userId, userId));
  await clearFailures(`login:email:${u.email}`);
  await sendEmail(temporaryPasswordEmail(u.email, u.firstName, 'customer'));
  return { password, email: u.email };
}

/** Staff edit a customer's name, email or phone (DemoCheckList item 19). */
export async function updateCustomerDetails(
  userId: number,
  input: { firstName: string; lastName: string; email: string; phone: string | null }
) {
  const before = await mustExist(userId);
  try {
    await db.update(users).set({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone || null,
    }).where(eq(users.userId, userId));
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ConflictError('Another account already uses that email or phone');
    throw err;
  }
  const changed = (['firstName', 'lastName', 'email', 'phone'] as const).filter((k) => (before[k] ?? null) !== (input[k] || null));
  return { changed, email: input.email };
}

/**
 * Emails the customer a normal "reset your password" link (the same one the forgot-password form
 * sends). Staff never see the link or the password, so this is safe for an employee to do while
 * answering a ticket. Nothing about the account changes until the customer uses the link.
 */
export async function sendCustomerResetLink(userId: number, ip: string) {
  const u = await mustExist(userId);
  await new AuthService().requestPasswordReset(u.email, ip);
  return { email: u.email };
}

/**
 * Forces the customer to choose a new password: every session is signed out, the account is
 * flagged so the next sign-in has to set a new password, and a reset link is emailed. Their old
 * password still works to sign in once, which is what lets this be used in bulk - unlike
 * setCustomerTemporaryPassword, nothing has to be read off the screen and handed over.
 */
export async function forceCustomerPasswordReset(userId: number, ip: string) {
  const u = await mustExist(userId);
  await db.update(users).set({
    mustChangePassword: true,
    tokenVersion: sql`${users.tokenVersion} + 1`,
  }).where(eq(users.userId, userId));
  // The email is a convenience on top of the part that matters, which has already happened, so a
  // failure here must not report the row as untouched. requestPasswordReset has its own per-email
  // and per-IP limits, and a bulk reset of many accounts will hit the per-IP one: those customers
  // are still signed out and still have to set a new password, they just use "Forgot password?"
  // themselves instead of getting a link now.
  try {
    await new AuthService().requestPasswordReset(u.email, ip);
  } catch (err) {
    console.error('[customers-admin] reset link not sent after forced reset for user', userId, err);
    return { email: u.email, emailSent: false };
  }
  return { email: u.email, emailSent: true };
}

/**
 * "Delete" a customer. The row is never removed and no order is ever touched.
 *
 * Orders reference the user row (and their shipping address rows), the activity log refers to the
 * user id, and reporting sums over order history, so a real DELETE would either fail on a foreign
 * key or quietly break the staff order views and the sales figures. What we can do is remove the
 * person from the record: name, email, phone and every saved address are overwritten with neutral
 * placeholders, the account is disabled, and the token version is bumped so any session or
 * remembered device stops working immediately.
 *
 * The replacement email is unique per row and at a domain that cannot exist, so it neither
 * collides with the unique index nor can be mistaken for a real address.
 *
 * `deadHash` is a bcrypt hash of random bytes that were never stored: it makes the old password
 * stop working without having to hash something per row.
 */
export async function anonymiseCustomer(userId: number, deadHash: string) {
  const u = await mustExist(userId);
  await db.update(users).set({
    firstName: ANONYMISED.firstName,
    lastName: ANONYMISED.customerLastName,
    email: anonymisedEmail('customer', userId),
    phone: null,
    passwordHash: deadHash,
    isActive: false,
    mustChangePassword: false,
    tokenVersion: sql`${users.tokenVersion} + 1`,
  }).where(eq(users.userId, userId));
  // Addresses stay as rows because placed orders point at them; only their contents go.
  await db.update(addresses).set({
    street: ANONYMISED.address,
    city: ANONYMISED.address,
    state: ANONYMISED.address,
    zip: ANONYMISED.address,
    country: ANONYMISED.address,
  }).where(eq(addresses.userId, userId));
  await clearFailures(`login:email:${u.email}`);
  // The old address is returned for the activity log entry, so the action can be audited.
  return { email: u.email };
}

/** A bcrypt hash of random bytes that are then thrown away: no password matches it. */
export async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString('base64'));
}

export type BulkCustomerAction = 'deactivate' | 'activate' | 'force-reset' | 'delete';

/**
 * Applies one action to several customers, one row at a time.
 *
 * Deliberately not a single UPDATE ... WHERE user_id IN (...): every row is looked up and decided
 * on by itself, so an id that does not exist is skipped and reported instead of silently widening
 * or failing the whole request. The caller has already checked that the acting staff member holds
 * customers.manage and (for destructive actions) re-confirmed their password.
 */
export async function bulkCustomerAction(
  action: BulkCustomerAction,
  userIds: number[],
  ip: string,
  /** Called once per row that was actually changed, so each target gets its own audit entry. */
  log?: (action: string, details: Record<string, unknown>) => Promise<void>
): Promise<{ results: BulkOutcome[] }> {
  const existing = await db
    .select({ userId: users.userId, isActive: users.isActive })
    .from(users)
    .where(inArray(users.userId, userIds));
  const found = new Map(existing.map((r) => [r.userId, r]));
  // One hash for the whole batch: bcrypt at cost 12 is far too slow to run per row.
  const deadHash = action === 'delete' ? await unusablePasswordHash() : '';

  const results: BulkOutcome[] = [];
  for (const id of userIds) {
    const row = found.get(id);
    if (!row) {
      results.push({ id, ok: false, reason: 'No such customer' });
      continue;
    }
    try {
      let previousEmail: string | undefined;
      switch (action) {
        case 'deactivate':
          await setCustomerActive(id, false);
          break;
        case 'activate':
          await setCustomerActive(id, true);
          break;
        case 'force-reset':
          await forceCustomerPasswordReset(id, ip);
          break;
        case 'delete':
          previousEmail = (await anonymiseCustomer(id, deadHash)).email;
          break;
      }
      // One activity-log entry per target, not one for the batch, so an audit can see each account.
      await log?.(`customer.bulk_${action.replace('-', '_')}`, { userId: id, ...(previousEmail ? { previousEmail } : {}) });
      results.push({ id, ok: true });
    } catch (err) {
      // One bad row must not abandon the rest. The staff member sees which ones were skipped.
      console.error('[customers-admin] bulk', action, 'failed for', id, err);
      results.push({ id, ok: false, reason: 'Could not be updated' });
    }
  }
  return { results };
}
