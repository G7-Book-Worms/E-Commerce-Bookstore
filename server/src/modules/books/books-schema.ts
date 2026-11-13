// Tables live in server/db/schema.ts (the single source of truth for the DB).
import { z } from 'zod';
export { books, bookCategories } from '../../../db/schema';
export type { Book, NewBook, BookCategory } from '../../../db/schema';

export const createBookInputSchema = z.object({
  isbn: z.string().min(10).max(17),
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  description: z.string().min(1),
  priceCents: z.number().int().min(0),
  stock: z.number().int().min(0).default(0),
  categoryId: z.number().int().positive().nullable().optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
});
export const updateBookInputSchema = createBookInputSchema.partial();

export type CreateBookInput = z.infer<typeof createBookInputSchema>;
export type UpdateBookInput = z.infer<typeof updateBookInputSchema>;
