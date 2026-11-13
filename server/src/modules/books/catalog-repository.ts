// Catalog queries (SCRUM-176): search, filter, sort and page books with their tags and formats.
import { sql, inArray, eq, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { bookCategories, bookFormats, bookTags, books } from '../../../db/schema';
import { FORMATS, SECTIONS, SORT_OPTIONS, withPricing, type CatalogBook, type SortKey } from '@/lib/catalog';

const flag = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')
  .optional();
const cents = z.coerce.number().int('Prices are whole cents').min(0, 'Prices cannot be negative').optional();

// Query string for GET /api/books. Unknown params are ignored; bad values become a 400.
export const catalogQuerySchema = z
  .object({
    section: z.string().trim().max(50).optional(),
    genre: z.string().trim().max(50).optional(),
    format: z.enum(FORMATS, { message: 'format must be hardcover or paperback' }).optional(),
    q: z.string().trim().max(100, 'Search is too long').optional(),
    onSale: flag,
    inStock: flag,
    minPrice: cents,
    maxPrice: cents,
    minRating: z.coerce.number().min(0).max(5, 'minRating must be between 0 and 5').optional(),
    sort: z
      .enum(Object.keys(SORT_OPTIONS) as [SortKey, ...SortKey[]], { message: 'Unknown sort option' })
      .optional(),
    page: z.coerce.number().int().min(1, 'page starts at 1').default(1),
    pageSize: z.coerce.number().int().min(1).max(48, 'pageSize can be at most 48').default(24),
  })
  .refine((p) => p.minPrice === undefined || p.maxPrice === undefined || p.minPrice <= p.maxPrice, {
    message: 'minPrice must not be more than maxPrice',
  });

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export function parseCatalogQuery(params: URLSearchParams | Record<string, string | string[] | undefined>) {
  const raw: Record<string, string> = {};
  const entries = params instanceof URLSearchParams ? params.entries() : Object.entries(params);
  for (const [k, v] of entries) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== '') raw[k] = value;
  }
  return catalogQuerySchema.parse(raw);
}

// Raw SELECT through mysql2: execute() returns [rows, fields]
type Row = Record<string, unknown>;
async function selectRows(query: SQL): Promise<Row[]> {
  const [rows] = (await db.execute(query)) as unknown as [Row[]];
  return rows;
}

// Escape LIKE wildcards so a search for "100%" means the text "100%"
const likeTerm = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// Effective price (sale price counts) of the cheapest in-stock format, else the cheapest format
const fromPrice = sql`(SELECT COALESCE(
    MIN(CASE WHEN f.stock > 0 THEN COALESCE(f.sale_price_cents, f.price_cents) END),
    MIN(COALESCE(f.sale_price_cents, f.price_cents)))
  FROM book_formats f WHERE f.book_id = b.book_id)`;
const totalStock = sql`(SELECT COALESCE(SUM(f.stock), 0) FROM book_formats f WHERE f.book_id = b.book_id)`;

export async function searchBooks(query: CatalogQuery) {
  const where: SQL[] = [sql`1 = 1`];
  let relevance: SQL = sql`0`;

  if (query.section) where.push(sql`EXISTS (SELECT 1 FROM book_tags t WHERE t.book_id = b.book_id AND t.tag = ${query.section})`);
  if (query.genre) {
    where.push(sql`(EXISTS (SELECT 1 FROM book_tags t WHERE t.book_id = b.book_id AND t.tag = ${query.genre})
      OR EXISTS (SELECT 1 FROM book_categories c WHERE c.category_id = b.category_id AND c.slug = ${query.genre}))`);
  }
  if (query.format) where.push(sql`EXISTS (SELECT 1 FROM book_formats f WHERE f.book_id = b.book_id AND f.format = ${query.format})`);
  if (query.onSale) where.push(sql`EXISTS (SELECT 1 FROM book_formats f WHERE f.book_id = b.book_id AND f.sale_price_cents IS NOT NULL)`);
  if (query.inStock) where.push(sql`${totalStock} > 0`);
  if (query.minPrice !== undefined) where.push(sql`${fromPrice} >= ${query.minPrice}`);
  if (query.maxPrice !== undefined) where.push(sql`${fromPrice} <= ${query.maxPrice}`);
  if (query.minRating !== undefined) where.push(sql`b.rating_avg >= ${query.minRating}`);

  if (query.q) {
    const term = likeTerm(query.q);
    const digits = query.q.replace(/[^0-9Xx]/g, '');
    const isbnMatch = digits.length >= 4 ? sql`REPLACE(b.isbn, '-', '') LIKE ${likeTerm(digits)}` : sql`0`;
    where.push(sql`(b.title LIKE ${term} OR b.author LIKE ${term} OR b.description LIKE ${term} OR ${isbnMatch})`);
    // Best matches first: ISBN > title > author > description
    relevance = sql`(CASE WHEN ${isbnMatch} THEN 8 ELSE 0 END
      + CASE WHEN b.title LIKE ${term} THEN 4 ELSE 0 END
      + CASE WHEN b.author LIKE ${term} THEN 2 ELSE 0 END
      + CASE WHEN b.description LIKE ${term} THEN 1 ELSE 0 END)`;
  }

  const sort = query.sort ?? (query.q ? 'relevance' : 'newest');
  const orderBy: Record<SortKey, SQL> = {
    relevance: sql`${relevance} DESC, b.rating_count DESC, b.book_id DESC`,
    'price-asc': sql`${fromPrice} ASC, b.title ASC`,
    'price-desc': sql`${fromPrice} DESC, b.title ASC`,
    'availability-desc': sql`${totalStock} DESC, b.title ASC`,
    'availability-asc': sql`${totalStock} ASC, b.title ASC`,
    'rating-desc': sql`b.rating_avg DESC, b.rating_count DESC`,
    title: sql`b.title ASC`,
    newest: sql`b.book_id DESC`,
  };

  const whereSql = sql.join(where, sql` AND `);
  const offset = (query.page - 1) * query.pageSize;

  const countRows = await selectRows(sql`SELECT COUNT(*) AS total FROM books b WHERE ${whereSql}`);
  const total = Number(countRows[0]?.total ?? 0);

  const idRows = await selectRows(sql`
    SELECT b.book_id AS bookId FROM books b
    WHERE ${whereSql}
    ORDER BY ${orderBy[sort]}
    LIMIT ${query.pageSize} OFFSET ${offset}
  `);
  const ids = idRows.map((r) => Number(r.bookId));

  const list = await loadBooks(ids);
  return {
    books: list,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

// Loads full catalog records for these ids, keeping the given order
export async function loadBooks(ids: number[], withDetails = false): Promise<CatalogBook[]> {
  if (ids.length === 0) return [];

  const [rows, tags, formats] = await Promise.all([
    db
      .select({ book: books, category: bookCategories })
      .from(books)
      .leftJoin(bookCategories, eq(books.categoryId, bookCategories.categoryId))
      .where(inArray(books.bookId, ids)),
    db.select().from(bookTags).where(inArray(bookTags.bookId, ids)),
    db.select().from(bookFormats).where(inArray(bookFormats.bookId, ids)),
  ]);

  const byId = new Map(rows.map((r) => [r.book.bookId, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map(({ book, category }) =>
      withPricing({
        bookId: book.bookId,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        coverImageUrl: book.coverImageUrl,
        ratingAvg: Number(book.ratingAvg),
        ratingCount: book.ratingCount,
        tags: tags.filter((t) => t.bookId === book.bookId).map((t) => t.tag),
        formats: formats
          .filter((f) => f.bookId === book.bookId)
          .sort((a, b) => FORMATS.indexOf(a.format) - FORMATS.indexOf(b.format))
          .map((f) => ({ format: f.format, priceCents: f.priceCents, salePriceCents: f.salePriceCents, stock: f.stock })),
        ...(withDetails
          ? {
              description: book.description,
              category: category ? { name: category.name, slug: category.slug } : null,
            }
          : {}),
      })
    );
}

// One book by ISBN (with or without dashes), with description and category
export async function findCatalogBookByIsbn(isbn: string): Promise<CatalogBook | null> {
  const digits = isbn.replace(/-/g, '');
  const [row] = await selectRows(
    sql`SELECT book_id AS bookId FROM books WHERE isbn = ${isbn} OR REPLACE(isbn, '-', '') = ${digits} LIMIT 1`
  );
  const id = row?.bookId;
  if (!id) return null;
  const [book] = await loadBooks([Number(id)], true);
  return book ?? null;
}

// Sections for the catalog page: up to `perRow` books per section, in one round of queries
export async function catalogRows(perRow = 12) {
  return Promise.all(
    SECTIONS.map(async (s) => {
      const params = new URLSearchParams(s.param);
      params.set('pageSize', String(perRow));
      params.set('sort', s.key === 'on-sale' ? 'price-asc' : 'rating-desc');
      const result = await searchBooks(parseCatalogQuery(params));
      return { ...s, books: result.books, total: result.total };
    })
  );
}
