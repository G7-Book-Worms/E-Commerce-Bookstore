import { NextRequest } from 'next/server';
import { BooksService } from './books-service';
import { createBookInputSchema, updateBookInputSchema } from './books-schema';
import { HttpResponse } from '../../shared/http/api-response';

const booksService = new BooksService();

export class BooksController {
  static async list(req: NextRequest) {
    const url = req.nextUrl;
    const genre = url.searchParams.get('genre') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const books = await booksService.listBooks({ genre, search, limit, offset });
    return HttpResponse.success(books);
  }

  static async getById(req: NextRequest, id: string) {
    const book = await booksService.getBookById(id);
    return HttpResponse.success(book);
  }

  static async create(req: NextRequest) {
    const body = await req.json();
    const validated = createBookInputSchema.parse(body);

    const newBook = await booksService.createBook(validated);
    return HttpResponse.created(newBook, 'Book created successfully');
  }

  static async update(req: NextRequest, id: string) {
    const body = await req.json();
    const validated = updateBookInputSchema.parse(body);

    const updated = await booksService.updateBook(id, validated);
    return HttpResponse.success(updated, 'Book updated successfully');
  }
}