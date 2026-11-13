// Staff management of customer accounts (SCRUM-200): search, view, deactivate/reactivate,
// set a temporary password, and sign the customer out of every device.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { addresses, orders, users } from '../../../db/schema';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { isDuplicateKeyError } from '../auth/auth-service';
import { hashPassword } from '../../shared/utils/hash-utils';
import { clearFailures } from '../../shared/security/rate-limit';
import { isPlacedOrder } from '../orders/placed-orders';
import { temporaryPassword } from '../staff/staff-auth';
import { sendEmail } from '../email/mailer';
import { temporaryPasswordEmail } from '../email/templates';

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
  return rows.map((r) => ({ ...r, orderCount: Number(r.orderCount), spentCents: Number(r.spentCents) }));
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
