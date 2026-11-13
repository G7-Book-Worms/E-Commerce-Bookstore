// Staff add and edit books (DemoCheckList items 10 and 16, SCRUM-189).
// A new book's starting stock is recorded as a "restock" inventory movement.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { BOOK_FORMATS, bookCategories, bookFormats, bookTags, books } from '../../../db/schema';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { isDuplicateKeyError } from '../auth/auth-service';
import { changeStock } from '../inventory/inventory-service';
import { syncBookTotals } from './book-totals';

// Tags staff can pick: catalog sections + genres (see lib/catalog.ts SECTIONS)
export const BOOK_TAGS = [
  'bestseller', 'new-release', 'coming-soon', 'special-edition', 'trending', 'paperback-pick',
  'fiction', 'nonfiction', 'fantasy', 'history', 'science', 'technology',
] as const;

const cents = z.number().int().min(1, 'Prices must be at least $0.01').max(100000);
const coverUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || v.startsWith('https://cdn.shopify.com/') || /^\/images\/[\w\-/.]+$/.test(v), 'Covers must be on cdn.shopify.com or in /images (leave blank for a generated cover)')
  .transform((v) => v || null);

const detailsSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  author: z.string().trim().min(1, 'Author is required').max(100),
  description: z.string().trim().max(5000).default(''),
  categoryId: z.number().int().positive().nullable().optional(),
  coverImageUrl: coverUrl.optional().nullable(),
  tags: z.array(z.enum(BOOK_TAGS)).max(12).default([]),
});

const formatSchema = z.object({
  format: z.enum(BOOK_FORMATS),
  priceCents: cents,
  salePriceCents: cents.nullable().optional(),
  stock: z.number().int().min(0).max(10000).default(0),
  lowStockThreshold: z.number().int().min(0).max(1000).default(5),
}).refine((f) => !f.salePriceCents || f.salePriceCents < f.priceCents, { message: 'A sale price must be lower than the regular price', path: ['salePriceCents'] });

export const createBookSchema = detailsSchema.extend({
  isbn: z.string().trim().regex(/^(97[89])-?\d{1,5}-?\d{1,7}-?\d{1,7}-?\d$/, 'Enter a 13-digit ISBN starting with 978 or 979').max(17),
  formats: z.array(formatSchema).min(1, 'Add at least one format').max(2)
    .refine((f) => new Set(f.map((x) => x.format)).size === f.length, 'Each format only once'),
});

export const updateBookSchema = detailsSchema.extend({
  addFormat: formatSchema.optional(),
});

export async function listCategories() {
  return db.select().from(bookCategories).orderBy(asc(bookCategories.name));
}

export async function getBookForEdit(bookId: number) {
  const [book] = await db.select().from(books).where(eq(books.bookId, bookId));
  if (!book) throw new NotFoundError('Book not found');
  const [tags, formats] = await Promise.all([
    db.select({ tag: bookTags.tag }).from(bookTags).where(eq(bookTags.bookId, bookId)),
    db.select().from(bookFormats).where(eq(bookFormats.bookId, bookId)),
  ]);
  return { book, tags: tags.map((t) => t.tag), formats };
}

async function setTags(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], bookId: number, tags: string[]) {
  await tx.delete(bookTags).where(eq(bookTags.bookId, bookId));
  if (tags.length) await tx.insert(bookTags).values([...new Set(tags)].map((tag) => ({ bookId, tag })));
}

export async function createBook(staffId: number, input: z.infer<typeof createBookSchema>) {
  let bookId = 0;
  try {
    await db.transaction(async (tx) => {
      const [res] = (await tx.insert(books).values({
        isbn: input.isbn,
        title: input.title,
        author: input.author,
        description: input.description,
        categoryId: input.categoryId ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        priceCents: Math.min(...input.formats.map((f) => f.priceCents)),
      })) as unknown as [{ insertId: number }];
      bookId = res.insertId;
      await setTags(tx, bookId, input.tags);
      for (const f of input.formats) {
        const [fr] = (await tx.insert(bookFormats).values({
          bookId,
          format: f.format,
          priceCents: f.priceCents,
          salePriceCents: f.salePriceCents ?? null,
          stock: 0,
          lowStockThreshold: f.lowStockThreshold,
        })) as unknown as [{ insertId: number }];
        if (f.stock > 0) {
          await changeStock(tx, { bookFormatId: fr.insertId }, f.stock, 'restock', { adminId: staffId, note: 'Initial stock (new book)' });
        }
      }
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ConflictError('A book with that ISBN already exists');
    throw err;
  }
  await syncBookTotals(bookId);
  return bookId;
}

export async function updateBook(staffId: number, bookId: number, input: z.infer<typeof updateBookSchema>) {
  const [book] = await db.select().from(books).where(eq(books.bookId, bookId));
  if (!book) throw new NotFoundError('Book not found');
  await db.transaction(async (tx) => {
    await tx.update(books).set({
      title: input.title,
      author: input.author,
      description: input.description,
      categoryId: input.categoryId ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
    }).where(eq(books.bookId, bookId));
    await setTags(tx, bookId, input.tags);
    if (input.addFormat) {
      const f = input.addFormat;
      const existing = await tx.select({ id: bookFormats.bookFormatId }).from(bookFormats)
        .where(and(eq(bookFormats.bookId, bookId), eq(bookFormats.format, f.format)));
      if (existing.length) throw new ConflictError(`This book already has a ${f.format} format`);
      const [fr] = (await tx.insert(bookFormats).values({
        bookId, format: f.format, priceCents: f.priceCents, salePriceCents: f.salePriceCents ?? null, stock: 0, lowStockThreshold: f.lowStockThreshold,
      })) as unknown as [{ insertId: number }];
      if (f.stock > 0) await changeStock(tx, { bookFormatId: fr.insertId }, f.stock, 'restock', { adminId: staffId, note: 'Initial stock (new format)' });
    }
  });
  await syncBookTotals(bookId);
  return { before: { title: book.title, author: book.author }, isbn: book.isbn };
}

export async function bookIdsByFormat(formatIds: number[]) {
  if (!formatIds.length) return [];
  return db.select({ bookId: bookFormats.bookId }).from(bookFormats).where(inArray(bookFormats.bookFormatId, formatIds));
}
