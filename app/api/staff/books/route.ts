import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { createBook, createBookSchema } from '@/server/src/modules/books/books-admin';

// POST /api/staff/books: add a new book with its formats and starting stock
export const POST = staffApi('inventory.update', async (req, { log, staff }) => {
  const input = createBookSchema.parse(await req.json());
  const bookId = await createBook(staff.id, input);
  await log('book.created', { bookId, isbn: input.isbn, title: input.title });
  return HttpResponse.created({ bookId }, `Added “${input.title}”`);
});
