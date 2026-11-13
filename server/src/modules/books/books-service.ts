// server/src/modules/books/books-service.ts
import { BooksRepository, BookFilterParams } from './books-repository';
import { CreateBookInput, UpdateBookInput, Book } from './books-schema';
import { NotFoundError, BadRequestError } from '../../shared/errors/app-error';

export class BooksService {
  constructor(private booksRepo = new BooksRepository()) {}

  async getBookById(bookId: number | string): Promise<Book> {
    const numericId = Number(bookId);
    if (isNaN(numericId)) {
      throw new BadRequestError('Invalid book ID format');
    }

    const book = await this.booksRepo.findById(numericId);
    if (!book) {
      throw new NotFoundError('Book not found');
    }
    return book;
  }

  async getAllBooks(params?: BookFilterParams): Promise<Book[]> {
    return this.booksRepo.findAll(params);
  }

  async getFeaturedByGenre(genre: string, limit: number = 8) {
    return this.booksRepo.findByGenreSlug(genre, limit);
  }

  async createBook(input: CreateBookInput): Promise<Book> {
    const existing = await this.booksRepo.findByIsbn(input.isbn);
    if (existing) {
      throw new BadRequestError('A book with this ISBN already exists');
    }

    // Auto-increment primary key handled by MySQL
    return this.booksRepo.create(input);
  }

  async updateBook(bookId: number | string, input: UpdateBookInput): Promise<Book> {
    const numericId = Number(bookId);
    if (isNaN(numericId)) {
      throw new BadRequestError('Invalid book ID format');
    }

    const existing = await this.booksRepo.findById(numericId);
    if (!existing) {
      throw new NotFoundError('Book not found');
    }

    const updated = await this.booksRepo.update(numericId, input);
    if (!updated) {
      throw new NotFoundError('Failed to update book');
    }
    return updated;
  }

  async deleteBook(bookId: number | string): Promise<boolean> {
    const numericId = Number(bookId);
    if (isNaN(numericId)) {
      throw new BadRequestError('Invalid book ID format');
    }

    const existing = await this.booksRepo.findById(numericId);
    if (!existing) {
      throw new NotFoundError('Book not found');
    }

    return this.booksRepo.delete(numericId);
  }

  /**
   * SCRUM-133: Homepage data feed aggregator
   */
  async getHomepageFeed() {
    const categories = await this.booksRepo.getHomepageGenres();
    const event = await this.booksRepo.getActiveEvent();

    const carousels = await Promise.all(
      categories.map(async (cat) => {
        const booksList = await this.booksRepo.findByGenreSlug(cat.slug, 8);
        return {
          categoryId: cat.categoryId,
          categoryName: cat.name,
          categorySlug: cat.slug,
          books: booksList.map((b) => ({
            ...b,
            price: (b.priceCents / 100).toFixed(2),
          })),
        };
      })
    );

    return {
      promotion: event
        ? {
            headline: 'Special Limited Seasonal Offer',
            code: event.promotionalCode,
            startDate: event.startDate,
            endDate: event.endDate,
          }
        : {
            headline: 'Welcome to Book Worms',
            code: 'READMORE10',
            startDate: null,
            endDate: null,
          },
      carousels,
    };
  }
}