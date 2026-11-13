import { sql } from 'drizzle-orm';
import { db } from '../../../db';

/**
 * Keep books.price_cents / books.stock in step with book_formats:
 * price = lowest regular format price, stock = total across formats.
 * Call after changing a book's formats (seed, admin inventory edits, checkout).
 */
export async function syncBookTotals(bookId?: number) {
  await db.execute(sql`
    UPDATE books b
    SET
      b.price_cents = COALESCE((SELECT MIN(f.price_cents) FROM book_formats f WHERE f.book_id = b.book_id), b.price_cents),
      b.stock = COALESCE((SELECT SUM(f.stock) FROM book_formats f WHERE f.book_id = b.book_id), 0)
    WHERE EXISTS (SELECT 1 FROM book_formats f WHERE f.book_id = b.book_id)
    ${bookId === undefined ? sql`` : sql`AND b.book_id = ${bookId}`}
  `);
}
