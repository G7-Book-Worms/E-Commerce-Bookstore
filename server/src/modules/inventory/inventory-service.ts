// Inventory (SCRUM-189/210). Every stock change goes through changeStock(), which updates the
// format's stock and writes an inventory_movements row in the same transaction, so the portal can
// always show where each copy went. Formats at or below their low-stock threshold raise alerts.
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { admin, bookFormats, books, inventoryMovements } from '../../../db/schema';
import type { BookFormat } from '../../../db/schema';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { syncBookTotals } from '../books/book-totals';
import { sendEmail } from '../email/mailer';
import { lowStockEmail } from '../email/templates';
import { logActivity } from '../activity/activity-log';
import { recordStaffNotification } from '../tickets/notification-service';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reason = 'sale' | 'restock' | 'adjustment' | 'cancellation';

export interface StockChange {
  bookFormatId: number;
  stockAfter: number;
  threshold: number;
  /** true when this change moved the format from above the threshold to at/below it */
  becameLow: boolean;
}

/**
 * Adds (positive) or removes (negative) copies. Never lets stock go below zero:
 * throws ConflictError('OUT_OF_STOCK') instead, which rolls back the whole transaction.
 */
export async function changeStock(
  tx: Tx,
  target: { bookFormatId: number } | { bookId: number; format: BookFormat },
  quantityChange: number,
  reason: Reason,
  extra: { note?: string | null; orderId?: number | null; adminId?: number | null } = {}
): Promise<StockChange> {
  const where = 'bookFormatId' in target
    ? eq(bookFormats.bookFormatId, target.bookFormatId)
    : and(eq(bookFormats.bookId, target.bookId), eq(bookFormats.format, target.format));

  // Lock the row so two checkouts can't both take the last copy
  const [row] = await tx.select().from(bookFormats).where(where).for('update');
  if (!row) throw new NotFoundError('That book format does not exist');
  const stockAfter = row.stock + quantityChange;
  if (stockAfter < 0) throw new ConflictError('OUT_OF_STOCK');

  await tx.update(bookFormats).set({ stock: stockAfter }).where(eq(bookFormats.bookFormatId, row.bookFormatId));
  await tx.insert(inventoryMovements).values({
    bookFormatId: row.bookFormatId,
    quantityChange,
    stockAfter,
    reason,
    note: extra.note ?? null,
    orderId: extra.orderId ?? null,
    adminId: extra.adminId ?? null,
  });
  return {
    bookFormatId: row.bookFormatId,
    stockAfter,
    threshold: row.lowStockThreshold,
    becameLow: row.stock > row.lowStockThreshold && stockAfter <= row.lowStockThreshold,
  };
}

/** After a transaction commits: email the support inbox about formats that just ran low. */
export async function alertLowStock(changes: StockChange[]): Promise<void> {
  const low = changes.filter((c) => c.becameLow);
  if (!low.length) return;
  const rows = await db
    .select({ id: bookFormats.bookFormatId, bookId: books.bookId, title: books.title, format: bookFormats.format })
    .from(bookFormats)
    .innerJoin(books, eq(books.bookId, bookFormats.bookId))
    .where(sql`${bookFormats.bookFormatId} IN (${sql.join(low.map((l) => sql`${l.bookFormatId}`), sql`, `)})`);
  const items = low.map((l) => {
    const r = rows.find((x) => x.id === l.bookFormatId);
    return {
      title: r?.title ?? `Format #${l.bookFormatId}`,
      format: r?.format ?? '',
      stock: l.stockAfter,
      threshold: l.threshold,
      bookId: r?.bookId ?? null,
    };
  });
  await logActivity('system', null, 'inventory.low_stock', { items });

  // Also file each alert in the portal's Alerts tab. Until now a low-stock alert was only
  // emailed to support@, so it fired with nowhere to show and looked like a bug (Session 4).
  // recordStaffNotification() swallows its own failures, so this cannot break a restock.
  for (const i of items) {
    await recordStaffNotification({
      kind: i.stock === 0 ? 'sold_out' : 'low_stock',
      title: i.stock === 0 ? `Sold out: ${i.title} (${i.format})` : `Low stock: ${i.title} (${i.format})`,
      body: `${i.stock} ${i.stock === 1 ? 'copy' : 'copies'} left; the alert level is ${i.threshold}.`,
      subjectType: 'book',
      subjectId: i.bookId,
    });
  }

  const to = process.env.SUPPORT_EMAIL;
  if (to) await sendEmail(lowStockEmail(to, items));
}

export type InventoryFilter = 'all' | 'low' | 'out' | 'sale';
export type InventorySort = 'title' | 'stock' | 'price';

/** One row per book format for the inventory table. */
export async function listInventory(opts: { q?: string; filter?: InventoryFilter; sort?: InventorySort; dir?: 'asc' | 'desc' }) {
  const conditions = [];
  if (opts.q) {
    const like = `%${opts.q}%`;
    conditions.push(sql`(${books.title} LIKE ${like} OR ${books.author} LIKE ${like} OR ${books.isbn} LIKE ${like})`);
  }
  if (opts.filter === 'low') conditions.push(sql`${bookFormats.stock} <= ${bookFormats.lowStockThreshold}`);
  if (opts.filter === 'out') conditions.push(sql`${bookFormats.stock} = 0`);
  if (opts.filter === 'sale') conditions.push(sql`${bookFormats.salePriceCents} IS NOT NULL`);
  const dirFn = opts.dir === 'desc' ? desc : asc;
  const orderBy =
    opts.sort === 'stock' ? [dirFn(bookFormats.stock), asc(books.title)]
    : opts.sort === 'price' ? [dirFn(bookFormats.priceCents), asc(books.title)]
    : [dirFn(books.title), asc(bookFormats.format)];

  return db
    .select({
      bookFormatId: bookFormats.bookFormatId,
      bookId: books.bookId,
      isbn: books.isbn,
      title: books.title,
      author: books.author,
      format: bookFormats.format,
      priceCents: bookFormats.priceCents,
      salePriceCents: bookFormats.salePriceCents,
      stock: bookFormats.stock,
      lowStockThreshold: bookFormats.lowStockThreshold,
    })
    .from(bookFormats)
    .innerJoin(books, eq(books.bookId, bookFormats.bookId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(...orderBy);
}

export async function inventoryCounts() {
  const [row] = await db
    .select({
      formats: sql<number>`COUNT(*)`,
      copies: sql<number>`COALESCE(SUM(${bookFormats.stock}), 0)`,
      low: sql<number>`SUM(${bookFormats.stock} <= ${bookFormats.lowStockThreshold} AND ${bookFormats.stock} > 0)`,
      out: sql<number>`SUM(${bookFormats.stock} = 0)`,
      onSale: sql<number>`SUM(${bookFormats.salePriceCents} IS NOT NULL)`,
    })
    .from(bookFormats);
  return {
    formats: Number(row?.formats ?? 0),
    copies: Number(row?.copies ?? 0),
    low: Number(row?.low ?? 0),
    out: Number(row?.out ?? 0),
    onSale: Number(row?.onSale ?? 0),
  };
}

export async function recentMovements(bookFormatId?: number, limit = 30) {
  return db
    .select({
      movementId: inventoryMovements.movementId,
      created: inventoryMovements.created,
      quantityChange: inventoryMovements.quantityChange,
      stockAfter: inventoryMovements.stockAfter,
      reason: inventoryMovements.reason,
      note: inventoryMovements.note,
      orderId: inventoryMovements.orderId,
      staffName: sql<string | null>`CONCAT(${admin.firstName}, ' ', ${admin.lastName})`,
      title: books.title,
      format: bookFormats.format,
    })
    .from(inventoryMovements)
    .innerJoin(bookFormats, eq(bookFormats.bookFormatId, inventoryMovements.bookFormatId))
    .innerJoin(books, eq(books.bookId, bookFormats.bookId))
    .leftJoin(admin, eq(admin.adminId, inventoryMovements.adminId))
    .where(bookFormatId ? eq(inventoryMovements.bookFormatId, bookFormatId) : undefined)
    .orderBy(desc(inventoryMovements.created), desc(inventoryMovements.movementId))
    .limit(limit);
}

/** Staff restock / correction from the portal. */
export async function staffStockChange(
  staffId: number,
  bookFormatId: number,
  kind: 'restock' | 'adjustment',
  quantityChange: number,
  note: string | null
) {
  let change!: StockChange;
  await db.transaction(async (tx) => {
    change = await changeStock(tx, { bookFormatId }, quantityChange, kind, { note, adminId: staffId });
  });
  const [fmt] = await db.select({ bookId: bookFormats.bookId }).from(bookFormats).where(eq(bookFormats.bookFormatId, bookFormatId));
  if (fmt) await syncBookTotals(fmt.bookId);
  await alertLowStock([change]);
  return change;
}

/** Price, sale price and alert threshold for one format. */
export async function updateFormatPricing(
  bookFormatId: number,
  input: { priceCents?: number; salePriceCents?: number | null; lowStockThreshold?: number }
) {
  const [row] = await db.select().from(bookFormats).where(eq(bookFormats.bookFormatId, bookFormatId));
  if (!row) throw new NotFoundError('That book format does not exist');
  const price = input.priceCents ?? row.priceCents;
  const sale = input.salePriceCents === undefined ? row.salePriceCents : input.salePriceCents;
  if (sale !== null && sale >= price) throw new ConflictError('The sale price must be lower than the regular price');
  const threshold = input.lowStockThreshold ?? row.lowStockThreshold;
  await db.update(bookFormats).set({ priceCents: price, salePriceCents: sale, lowStockThreshold: threshold })
    .where(eq(bookFormats.bookFormatId, bookFormatId));
  await syncBookTotals(row.bookId);
  return {
    before: { priceCents: row.priceCents, salePriceCents: row.salePriceCents, lowStockThreshold: row.lowStockThreshold },
    after: { priceCents: price, salePriceCents: sale, lowStockThreshold: threshold },
  };
}
