// server/src/modules/books/recommendations.ts
// "You may like" on the product page: books similar to the one being viewed.
//
// Each candidate gets points for what it shares with the book:
//   same author             +6  ("Also by …")
//   bought in the same order +3 per order, capped at +9 ("Bought together")
//   same genre              +3
//   each shared tag          +2, capped at +6 (tags are things like "cozy", "time travel")
// then small nudges: in stock (+1), on sale (+0.5), and rating as a tie-breaker. Sold-out books
// sink but aren't hidden. "Bought together" comes from real orders on this site; with demo data
// it's thin, so it only ever adds to the other signals instead of replacing them.
import { and, eq, inArray, ne, notInArray, or, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { bookTags, books, orderItems, orders, payments } from '../../../db/schema';
import { rankRecommendations, type Recommendation, type Target } from './recommendation-ranking';
import { loadBooks } from './catalog-repository';

export type { Recommendation } from './recommendation-ranking';

/** Books bought in the same paid, not-cancelled orders as `bookId`, with how many orders. */
async function boughtTogetherWith(bookId: number): Promise<Map<number, number>> {
  const withBook = db
    .select({ orderId: orderItems.orderId })
    .from(orderItems)
    .innerJoin(orders, eq(orders.orderId, orderItems.orderId))
    .innerJoin(payments, eq(payments.orderId, orders.orderId))
    .where(and(eq(orderItems.bookId, bookId), ne(orders.status, 'cancelled'), notInArray(payments.status, ['pending', 'failed'])));
  const rows = await db
    .select({ bookId: orderItems.bookId, n: sql<number>`COUNT(DISTINCT ${orderItems.orderId})` })
    .from(orderItems)
    .where(and(inArray(orderItems.orderId, withBook), ne(orderItems.bookId, bookId)))
    .groupBy(orderItems.bookId);
  return new Map(rows.map((r) => [r.bookId, Number(r.n)]));
}

/** Up to `limit` suggestions for a book page. Never throws: a failure just means no row. */
export async function youMayLike(target: Target & { categoryId?: number | null }, limit = 12): Promise<Recommendation[]> {
  try {
    const [together, [row]] = await Promise.all([
      boughtTogetherWith(target.bookId),
      db.select({ categoryId: books.categoryId }).from(books).where(eq(books.bookId, target.bookId)).limit(1),
    ]);
    const categoryId = row?.categoryId ?? null;
    const tagged = target.tags.length
      ? db.select({ id: bookTags.bookId }).from(bookTags).where(inArray(bookTags.tag, target.tags))
      : null;

    // Everything that shares at least one signal, capped so a huge genre can't blow up the page
    const conditions = [eq(books.author, target.author)];
    if (categoryId !== null) conditions.push(eq(books.categoryId, categoryId));
    if (tagged) conditions.push(inArray(books.bookId, tagged));
    if (together.size) conditions.push(inArray(books.bookId, [...together.keys()]));
    const ids = await db
      .select({ id: books.bookId, categoryId: books.categoryId })
      .from(books)
      .where(and(ne(books.bookId, target.bookId), or(...conditions)))
      .limit(120);

    const candidates = await loadBooks(ids.map((r) => r.id));
    const slugById = new Map(ids.map((r) => [r.id, r.categoryId === categoryId && categoryId !== null ? target.category?.slug ?? null : null]));
    return rankRecommendations(
      target,
      candidates.map((c) => ({ ...c, categorySlug: slugById.get(c.bookId) ?? null })),
      together,
      limit
    );
  } catch (err) {
    console.error('[recommendations] failed', err instanceof Error ? err.message : err);
    return [];
  }
}
