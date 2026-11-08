// server/src/modules/books/books-schema.ts
import { mysqlTable, int, varchar, text } from 'drizzle-orm/mysql-core';

export const bookCategories = mysqlTable('book_categories', {
  categoryId: int('category_id').autoincrement().primaryKey().notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  slug: varchar('slug', { length: 50 }).notNull(),
});

export const books = mysqlTable('books', {
  bookId: int('book_id').autoincrement().primaryKey().notNull(),
  categoryId: int('category_id').references(() => bookCategories.categoryId),
  isbn: varchar('isbn', { length: 17 }).notNull(),
  author: varchar('author', { length: 100 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  priceCents: int('price_cents').notNull().default(0),
  stock: int('stock').default(0).notNull(),
});

export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type BookCategory = typeof bookCategories.$inferSelect;

// Export DTO types required by books-service.ts
export type CreateBookInput = Omit<NewBook, 'bookId'>;
export type UpdateBookInput = Partial<CreateBookInput>;