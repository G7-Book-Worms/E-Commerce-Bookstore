// Staff view of orders (SCRUM-188): sortable list, detail, and status changes.
// Abandoned Stripe checkouts are hidden everywhere with isPlacedOrder.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { activityLog, addresses, books, orderItems, orders, payments, users } from '../../../db/schema';
import { isPlacedOrder } from './placed-orders';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';
import { changeStock } from '../inventory/inventory-service';
import { syncBookTotals } from '../books/book-totals';
import { sendEmail } from '../email/mailer';
import { orderStatusEmail } from '../email/templates';
import { isCarrier, normalizeTrackingNumber, validateTrackingNumber, type Carrier } from './carriers';

export const ORDER_STATUSES = ['pending', 'transit', 'arrived', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Processing',
  transit: 'Shipped',
  arrived: 'Delivered',
  cancelled: 'Cancelled',
};
// Which status an order may move to next
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ['transit', 'cancelled'],
  transit: ['arrived', 'cancelled'],
  arrived: [],
  cancelled: [],
};

export type OrderSort = 'date' | 'customer' | 'total' | 'status';
export const PAGE_SIZE = 25;

const customerName = sql<string>`COALESCE(CONCAT(${users.firstName}, ' ', ${users.lastName}), 'Deleted account')`;

export async function listOrders(opts: {
  q?: string;
  status?: string;
  sort?: OrderSort;
  dir?: 'asc' | 'desc';
  page?: number;
  userId?: number;
}) {
  const conds = [isPlacedOrder];
  if (opts.status && (ORDER_STATUSES as readonly string[]).includes(opts.status)) {
    conds.push(eq(orders.status, opts.status as OrderStatus));
  }
  if (opts.userId) conds.push(eq(orders.userId, opts.userId));
  if (opts.q) {
    const q = opts.q.replace(/^#/, '');
    const like = `%${q}%`;
    conds.push(sql`(${orders.orderId} = ${Number(q) || 0} OR ${users.email} LIKE ${like} OR CONCAT(${users.firstName}, ' ', ${users.lastName}) LIKE ${like})`);
  }
  const dir = opts.dir === 'asc' ? asc : desc;
  const orderBy =
    opts.sort === 'customer' ? [dir(customerName), desc(orders.orderId)]
    : opts.sort === 'total' ? [dir(orders.priceCents), desc(orders.orderId)]
    : opts.sort === 'status' ? [dir(orders.status), desc(orders.orderId)]
    : [dir(orders.created), dir(orders.orderId)];
  const page = Math.max(1, opts.page ?? 1);
  const where = and(...conds);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        orderId: orders.orderId,
        created: orders.created,
        status: orders.status,
        totalCents: orders.priceCents,
        userId: orders.userId,
        customerName,
        email: users.email,
        itemCount: sql<number>`(SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = ${orders.orderId})`,
        paymentStatus: sql<string | null>`(SELECT p.status FROM payments p WHERE p.order_id = ${orders.orderId} ORDER BY p.payment_id DESC LIMIT 1)`,
      })
      .from(orders)
      .leftJoin(users, eq(users.userId, orders.userId))
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`COUNT(*)` }).from(orders).leftJoin(users, eq(users.userId, orders.userId)).where(where),
  ]);
  return { rows: rows.map((r) => ({ ...r, itemCount: Number(r.itemCount) })), total: Number(total), page, pageSize: PAGE_SIZE };
}

export async function getOrderDetail(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.orderId, orderId));
  if (!order) throw new NotFoundError('Order not found');
  const [items, [payment], [address], [customer], history] = await Promise.all([
    db
      .select({
        orderItemId: orderItems.orderItemId,
        bookId: orderItems.bookId,
        format: orderItems.format,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
      })
      .from(orderItems)
      .innerJoin(books, eq(books.bookId, orderItems.bookId))
      .where(eq(orderItems.orderId, orderId)),
    db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.paymentId)).limit(1),
    db.select().from(addresses).where(eq(addresses.addressId, order.shippingAddressId)),
    order.userId
      ? db.select({ userId: users.userId, firstName: users.firstName, lastName: users.lastName, email: users.email, phone: users.phone })
          .from(users).where(eq(users.userId, order.userId))
      : Promise.resolve([]),
    db.select().from(activityLog)
      .where(sql`JSON_UNQUOTE(JSON_EXTRACT(${activityLog.details}, '$.orderId')) = ${String(orderId)}`)
      .orderBy(asc(activityLog.created), asc(activityLog.activityId)),
  ]);
  return { order, items, payment: payment ?? null, address: address ?? null, customer: customer ?? null, history };
}

/**
 * Moves an order along: Processing -> Shipped -> Delivered, or Cancelled before delivery.
 * Cancelling puts the copies back in stock (logged as inventory movements). The customer gets an email.
 */
export async function updateOrderStatus(
  staffId: number,
  orderId: number,
  input: { status: OrderStatus; carrier?: string | null; trackingNumber?: string | null; note?: string | null }
) {
  const [order] = await db.select().from(orders).where(eq(orders.orderId, orderId));
  if (!order) throw new NotFoundError('Order not found');
  const from = order.status as OrderStatus;

  // Carrier and number live in their own columns. A blank number leaves both alone, so a
  // status change that says nothing about shipping keeps whatever was already recorded.
  let tracking = order.trackingNumber;
  let carrier: Carrier | null = order.carrier;
  if (input.trackingNumber != null && normalizeTrackingNumber(input.trackingNumber) !== '') {
    const check = validateTrackingNumber(input.carrier, input.trackingNumber);
    if (!check.ok) throw new BadRequestError(check.error ?? 'That tracking number does not look right');
    tracking = check.value;
    carrier = isCarrier(input.carrier) ? input.carrier : null;
  }

  if (from === input.status) {
    // Same status: only the tracking number / note change
    await db.update(orders).set({
      carrier,
      trackingNumber: tracking,
      note: input.note ?? order.note,
    }).where(eq(orders.orderId, orderId));
    return { from, to: from, emailed: false };
  }
  if (!NEXT_STATUSES[from].includes(input.status)) {
    throw new BadRequestError(`An order that is ${STATUS_LABELS[from]} can't be changed to ${STATUS_LABELS[input.status]}`);
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  await db.transaction(async (tx) => {
    await tx.update(orders).set({
      status: input.status,
      carrier,
      trackingNumber: tracking,
      note: input.note ?? order.note,
    }).where(eq(orders.orderId, orderId));
    if (input.status === 'cancelled') {
      for (const item of items) {
        await changeStock(tx, { bookId: item.bookId, format: item.format }, item.quantity, 'cancellation', {
          orderId,
          adminId: staffId,
          note: `Order #${orderId} cancelled`,
        });
      }
    }
  });
  if (input.status === 'cancelled') await syncBookTotals();

  let emailed = false;
  if (order.userId) {
    const [u] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.userId, order.userId));
    if (u) emailed = await sendEmail(orderStatusEmail(u.email, u.firstName, orderId, input.status, carrier, tracking));
  }
  return { from, to: input.status, emailed };
}

/** The most orders one bulk action may touch. Also enforced by the API route's schema. */
export const BULK_LIMIT = 50;

/**
 * Applies one status change to several orders (the bulk action bar on the orders list).
 *
 * Orders are handled one at a time and independently: an order that can't make the move
 * (already delivered, already cancelled, no longer there) is reported as skipped with the
 * reason instead of failing the whole batch. Nothing here bypasses `updateOrderStatus`, so
 * cancelling still restocks and still emails the customer.
 */
export async function bulkUpdateOrderStatus(staffId: number, orderIds: number[], status: OrderStatus) {
  const unique = [...new Set(orderIds)];
  if (unique.length === 0) throw new BadRequestError('Pick at least one order');
  if (unique.length > BULK_LIMIT) throw new BadRequestError(`Too many orders at once (limit ${BULK_LIMIT})`);

  const updated: number[] = [];
  const skipped: { orderId: number; reason: string }[] = [];
  for (const orderId of unique) {
    try {
      const result = await updateOrderStatus(staffId, orderId, { status });
      if (result.from === result.to) skipped.push({ orderId, reason: `Already ${STATUS_LABELS[status]}` });
      else updated.push(orderId);
    } catch (err) {
      skipped.push({ orderId, reason: err instanceof Error ? err.message : 'Could not be updated' });
    }
  }
  return { status, updated, skipped };
}

/** Revenue and order counts per day for the dashboard chart (placed orders, excluding cancelled). */
export async function dailySales(days = 14) {
  const rows = await db
    .select({
      day: sql<string>`DATE_FORMAT(${orders.created}, '%Y-%m-%d')`,
      orders: sql<number>`COUNT(*)`,
      revenueCents: sql<number>`COALESCE(SUM(${orders.priceCents}), 0)`,
    })
    .from(orders)
    .where(and(isPlacedOrder, sql`${orders.status} <> 'cancelled'`, sql`${orders.created} >= CURRENT_DATE - INTERVAL ${days - 1} DAY`))
    .groupBy(sql`DATE_FORMAT(${orders.created}, '%Y-%m-%d')`);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; orders: number; revenueCents: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({ day: key, orders: Number(r?.orders ?? 0), revenueCents: Number(r?.revenueCents ?? 0) });
  }
  return out;
}

export async function orderStats() {
  const [row] = await db
    .select({
      placed: sql<number>`COUNT(*)`,
      revenueCents: sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} <> 'cancelled' THEN ${orders.priceCents} END), 0)`,
      toShip: sql<number>`SUM(${orders.status} = 'pending')`,
      last30: sql<number>`SUM(${orders.created} >= CURRENT_DATE - INTERVAL 29 DAY)`,
    })
    .from(orders)
    .where(isPlacedOrder);
  return {
    placed: Number(row?.placed ?? 0),
    revenueCents: Number(row?.revenueCents ?? 0),
    toShip: Number(row?.toShip ?? 0),
    last30: Number(row?.last30 ?? 0),
  };
}

/** Best sellers by copies sold (placed, not cancelled). */
export async function topSellers(limit = 5) {
  const rows = await db
    .select({
      bookId: orderItems.bookId,
      title: books.title,
      copies: sql<number>`SUM(${orderItems.quantity})`,
      revenue: sql<string>`SUM(${orderItems.unitTotal})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.orderId, orderItems.orderId))
    .innerJoin(books, eq(books.bookId, orderItems.bookId))
    .where(and(isPlacedOrder, sql`${orders.status} <> 'cancelled'`))
    .groupBy(orderItems.bookId, books.title)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(limit);
  return rows.map((r) => ({ ...r, copies: Number(r.copies), revenueCents: Math.round(Number(r.revenue) * 100) }));
}
