// server/src/modules/cart/cart-service.ts
// All cart reads/writes for a logged-in user. Prices are in cents.
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { carts, cartItems } from './cart-schema';
import { books } from '../books/books-schema';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';

// Body for POST /api/cart (add or increment)
export const addToCartSchema = z.object({
  bookId: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

// Body for PATCH /api/cart (set an exact quantity)
export const updateCartItemSchema = z.object({
  bookId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

// Body (or ?bookId=) for DELETE /api/cart
export const removeCartItemSchema = z.object({
  bookId: z.number().int().positive(),
});

export interface CartLine {
  cartItemId: number;
  bookId: number;
  quantity: number;
  title: string;
  author: string;
  isbn: string;
  priceCents: number;
  coverImageUrl: string | null;
  stock: number;
  lineTotalCents: number;
}

export interface CartView {
  cartId: number | null;
  items: CartLine[];
  /** Total number of copies in the cart (sum of quantities). */
  totalCount: number;
  subtotalCents: number;
}

export class CartService {
  private async findCart(userId: number) {
    const [cart] = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
    return cart ?? null;
  }

  private async findOrCreateCart(userId: number) {
    const existing = await this.findCart(userId);
    if (existing) return existing;
    await db.insert(carts).values({ userId });
    const created = await this.findCart(userId);
    if (!created) throw new Error('Failed to create cart');
    return created;
  }

  private async findBookOrThrow(bookId: number) {
    const [book] = await db
      .select({ bookId: books.bookId, title: books.title, stock: books.stock })
      .from(books)
      .where(eq(books.bookId, bookId))
      .limit(1);
    if (!book) throw new NotFoundError(`Book with ID ${bookId} not found`);
    return book;
  }

  private async findItem(cartId: number, bookId: number) {
    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.bookId, bookId)))
      .limit(1);
    return item ?? null;
  }

  private assertStock(book: { title: string; stock: number }, quantity: number) {
    if (quantity > book.stock) {
      throw new BadRequestError(
        `Only ${book.stock} cop${book.stock === 1 ? 'y' : 'ies'} of "${book.title}" in stock`
      );
    }
  }

  async getCart(userId: number): Promise<CartView> {
    const cart = await this.findCart(userId);
    if (!cart) return { cartId: null, items: [], totalCount: 0, subtotalCents: 0 };

    const rows = await db
      .select({
        cartItemId: cartItems.cartItemId,
        bookId: cartItems.bookId,
        quantity: cartItems.quantity,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        priceCents: books.priceCents,
        coverImageUrl: books.coverImageUrl,
        stock: books.stock,
      })
      .from(cartItems)
      .innerJoin(books, eq(books.bookId, cartItems.bookId))
      .where(eq(cartItems.cartId, cart.cartId))
      .orderBy(asc(cartItems.cartItemId));

    const items: CartLine[] = rows.map((r) => ({ ...r, lineTotalCents: r.priceCents * r.quantity }));
    return {
      cartId: cart.cartId,
      items,
      totalCount: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
    };
  }

  /** Adds a book, or increments its quantity if it is already in the cart. */
  async addItem(userId: number, bookId: number, quantity: number): Promise<CartView> {
    const book = await this.findBookOrThrow(bookId);
    const cart = await this.findOrCreateCart(userId);
    const existing = await this.findItem(cart.cartId, bookId);
    const newQuantity = (existing?.quantity ?? 0) + quantity;
    this.assertStock(book, newQuantity);

    if (existing) {
      await db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.cartItemId, existing.cartItemId));
    } else {
      await db.insert(cartItems).values({ cartId: cart.cartId, bookId, quantity });
    }
    return this.getCart(userId);
  }

  /** Sets the exact quantity of a book that is already in the cart. */
  async setQuantity(userId: number, bookId: number, quantity: number): Promise<CartView> {
    const book = await this.findBookOrThrow(bookId);
    const cart = await this.findCart(userId);
    const existing = cart ? await this.findItem(cart.cartId, bookId) : null;
    if (!cart || !existing) throw new NotFoundError('That book is not in your cart');
    this.assertStock(book, quantity);

    await db
      .update(cartItems)
      .set({ quantity })
      .where(eq(cartItems.cartItemId, existing.cartItemId));
    return this.getCart(userId);
  }

  /** Removes a book from the cart. Removing a book that isn't there is a no-op. */
  async removeItem(userId: number, bookId: number): Promise<CartView> {
    const cart = await this.findCart(userId);
    if (cart) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cart.cartId), eq(cartItems.bookId, bookId)));
    }
    return this.getCart(userId);
  }

  async clear(userId: number): Promise<void> {
    const cart = await this.findCart(userId);
    if (cart) {
      await db.delete(cartItems).where(eq(cartItems.cartId, cart.cartId));
    }
  }
}
