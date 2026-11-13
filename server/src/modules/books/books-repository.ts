// server/src/modules/books/books-repository.ts
import { eq, desc, and, lte, gte, or, like } from 'drizzle-orm';
import { db } from '../../../db';
import { books, bookCategories, Book, NewBook } from './books-schema';
import { events } from '../events/events-schema';

export interface BookFilterParams {
  genre?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class BooksRepository {
  async findById(bookId: number): Promise<Book | null> {
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.bookId, bookId))
      .limit(1);

    return book ?? null;
  }

  // SCRUM-93/Books: Find by ISBN
  async findByIsbn(isbn: string): Promise<Book | null> {
    const [book] = await db
      .select()
      .from(books)
      .where(eq(books.isbn, isbn))
      .limit(1);

    return book ?? null;
  }

  async findAll(params?: BookFilterParams | number, offset: number = 0): Promise<Book[]> {
    if (typeof params === 'number') {
      return db.select().from(books).limit(params).offset(offset);
    }

    const limit = params?.limit ?? 20;
    const pageOffset = params?.offset ?? 0;

    if (params?.genre) {
      return db
        .select({
          bookId: books.bookId,
          categoryId: books.categoryId,
          isbn: books.isbn,
          author: books.author,
          title: books.title,
          description: books.description,
          priceCents: books.priceCents,
          stock: books.stock,
          coverImageUrl: books.coverImageUrl,
          ratingAvg: books.ratingAvg,
          ratingCount: books.ratingCount,
        })
        .from(books)
        .innerJoin(bookCategories, eq(books.categoryId, bookCategories.categoryId))
        .where(eq(bookCategories.slug, params.genre))
        .limit(limit)
        .offset(pageOffset);
    }

    if (params?.search) {
      const term = `%${params.search}%`;
      return db
        .select()
        .from(books)
        .where(or(like(books.title, term), like(books.author, term), like(books.isbn, term)))
        .limit(limit)
        .offset(pageOffset);
    }

    return db.select().from(books).limit(limit).offset(pageOffset);
  }

  async create(data: NewBook): Promise<Book> {
    const [result]: any = await db.insert(books).values(data);
    const [created] = await db
      .select()
      .from(books)
      .where(eq(books.bookId, result.insertId))
      .limit(1);

    return created;
  }

  async update(bookId: number, data: Partial<NewBook>): Promise<Book | null> {
    await db
      .update(books)
      .set(data)
      .where(eq(books.bookId, bookId));

    return this.findById(bookId);
  }

  async delete(bookId: number): Promise<boolean> {
    const [res]: any = await db
      .delete(books)
      .where(eq(books.bookId, bookId));

    return res.affectedRows > 0;
  }

  // ==========================================
  // SCRUM-132: Homepage Queries
  // ==========================================

  async findByGenreSlug(genreSlug: string, limit: number = 8) {
    return db
      .select({
        bookId: books.bookId,
        isbn: books.isbn,
        author: books.author,
        title: books.title,
        description: books.description,
        priceCents: books.priceCents,
        stock: books.stock,
        coverImageUrl: books.coverImageUrl,
        categoryName: bookCategories.name,
        categorySlug: bookCategories.slug,
      })
      .from(books)
      .innerJoin(bookCategories, eq(books.categoryId, bookCategories.categoryId))
      .where(eq(bookCategories.slug, genreSlug))
      .limit(limit);
  }

  async getHomepageGenres() {
    return db.select().from(bookCategories).limit(4);
  }

  async getActiveEvent() {
    const today = new Date().toISOString().split('T')[0];
    const [active] = await db
      .select()
      .from(events)
      .where(and(lte(events.startDate, today), gte(events.endDate, today)))
      .limit(1);

    return active ?? null;
  }
}