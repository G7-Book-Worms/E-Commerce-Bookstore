// Catalog seed (SCRUM-175): tags, formats, sale prices, ratings, discount codes, admin employee IDs.
// Safe to run on a database that already has the base seed (Aiven): every step is an upsert keyed
// by a natural key (ISBN, tag, format, code, email), so running it twice changes nothing.
// Re-running it also resets demo stock and prices to the values in test-data.
import { eq, inArray, and, notInArray, sql } from "drizzle-orm";
import { db } from "../../index";
import { admin, bookFormats, bookTags, books, discountCodes } from "../../schema";
import { syncBookTotals } from "../../../src/modules/books/book-totals";

type SeedFormat = { format: "hardcover" | "paperback"; priceCents: number; salePriceCents: number | null; stock: number };
type SeedBook = {
  isbn: string; title: string; author: string; description: string;
  ratingAvg: string; ratingCount: number; tags: string[]; formats: SeedFormat[];
};
type SeedCode = { code: string; percentOff: number | null; amountOffCents: number | null; isActive: boolean; maxUses: number | null };
type SeedAdmin = { firstName: string; lastName: string; email: string; passwordHash: string; adminRole: string; employeeId: string };

export async function seedCatalog(data: { books: SeedBook[]; codes: SeedCode[]; admins: SeedAdmin[] }) {
  const rows = await db
    .select({ bookId: books.bookId, isbn: books.isbn })
    .from(books)
    .where(inArray(books.isbn, data.books.map((b) => b.isbn)));
  const idByIsbn = new Map(rows.map((r) => [r.isbn, r.bookId]));

  for (const b of data.books) {
    const bookId = idByIsbn.get(b.isbn);
    if (!bookId) {
      console.warn(`Catalog seed: no book with ISBN ${b.isbn}; skipping`);
      continue;
    }

    await db
      .update(books)
      .set({ title: b.title, author: b.author, description: b.description, ratingAvg: b.ratingAvg, ratingCount: b.ratingCount })
      .where(eq(books.bookId, bookId));

    // Tags: add missing ones, remove ones no longer listed
    await db
      .insert(bookTags)
      .values(b.tags.map((tag) => ({ bookId, tag })))
      .onDuplicateKeyUpdate({ set: { tag: sql`tag` } });
    await db.delete(bookTags).where(and(eq(bookTags.bookId, bookId), notInArray(bookTags.tag, b.tags)));

    // Formats: upsert listed formats, remove unlisted ones (that format then shows as unavailable)
    for (const f of b.formats) {
      await db
        .insert(bookFormats)
        .values({ bookId, ...f })
        .onDuplicateKeyUpdate({ set: { priceCents: f.priceCents, salePriceCents: f.salePriceCents, stock: f.stock } });
    }
    await db.delete(bookFormats).where(
      and(eq(bookFormats.bookId, bookId), notInArray(bookFormats.format, b.formats.map((f) => f.format)))
    );
  }
  await syncBookTotals();

  for (const c of data.codes) {
    await db
      .insert(discountCodes)
      .values(c)
      .onDuplicateKeyUpdate({ set: { percentOff: c.percentOff, amountOffCents: c.amountOffCents, isActive: c.isActive, maxUses: c.maxUses } });
  }

  // Demo staff accounts: one per role (admin, manager, employee). Inserted if missing.
  for (const a of data.admins) {
    await db
      .insert(admin)
      .values({ ...a, adminRole: a.adminRole as 'admin' | 'manager' | 'employee' })
      .onDuplicateKeyUpdate({ set: { employeeId: a.employeeId, adminRole: a.adminRole as 'admin' | 'manager' | 'employee' } });
  }

  console.log(`Catalog seeded: ${idByIsbn.size} books, ${data.codes.length} discount codes`);
}
