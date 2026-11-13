import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { updateBook, updateBookSchema } from '@/server/src/modules/books/books-admin';

// PUT /api/staff/books/:id: title, author, description, category, cover, tags (+ optionally a new format)
export const PUT = staffApi('inventory.update', async (req, { params, log, staff }) => {
  const bookId = idParam(params.id);
  const input = updateBookSchema.parse(await req.json());
  const result = await updateBook(staff.id, bookId, input);
  await log('book.updated', { bookId, isbn: result.isbn, title: input.title, addedFormat: input.addFormat?.format ?? null });
  return HttpResponse.success({ bookId }, 'Saved');
});
