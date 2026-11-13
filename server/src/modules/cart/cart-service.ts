// server/src/modules/cart/cart-service.ts
// All cart reads/writes for a logged-in user. Prices are in cents and always come from
// book_formats (the edition the shopper picked), never from the client.
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { carts, cartItems } from './cart-schema';
import { books, bookFormats, BOOK_FORMATS, type BookFormat } from '../../../db/schema';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';
import { priceOrder, unitPrice, describeDiscount, type OrderTotals } from './pricing';
import { findUsableDiscount } from '../discounts/discounts-repository';
import type { DiscountCode } from '../../../db/schema';

const format = z.enum(BOOK_FORMATS, { message: 'format must be hardcover or paperback' });
const quantity = z.number().int().positive().max(99, 'You can order up to 99 copies at a time');

// Body for POST /api/cart (add or increment). No format = the cheapest format in stock
export const addToCartSchema = z.object({
  bookId: z.number().int().positive(),
  format: format.optional(),
  quantity: quantity.default(1),
});

// Body for PATCH /api/cart (set an exact quantity)
export const updateCartItemSchema = z.object({
  bookId: z.number().int().positive(),
  format,
  quantity,
});

// Body (or ?bookId=&format=) for DELETE /api/cart. No format = every format of that book
export const removeCartItemSchema = z.object({
  bookId: z.number().int().positive(),
  format: format.optional(),
});

export interface CartLine {
  cartItemId: number;
  bookId: number;
  format: BookFormat;
  quantity: number;
  title: string;
  author: string;
  isbn: string;
  coverImageUrl: string | null;
  regularPriceCents: number;
  salePriceCents: number | null;
  unitPriceCents: number; // what one copy costs right now (sale price when on sale)
  onSale: boolean;
  stock: number; // copies of this format in stock
  lineTotalCents: number;
}

export interface CartView {
  cartId: number | null;
  items: CartLine[];
  /** Total number of copies in the cart (sum of quantities). */
  totalCount: number;
  /** Kept for older callers; same as totals.subtotalCents */
  subtotalCents: number;
  totals: OrderTotals;
  /** The discount code applied to these totals, if the shopper entered a valid one */
  discount: { discountCodeId: number; code: string; label: string } | null;
  /** Why the entered code didn't apply (shown under the code box) */
  discountError: string | null;
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

  // The edition being bought. No format given = the cheapest one in stock
  private async findFormatOrThrow(bookId: number, wanted?: BookFormat) {
    const rows = await db
      .select({
        format: bookFormats.format,
        priceCents: bookFormats.priceCents,
        salePriceCents: bookFormats.salePriceCents,
        stock: bookFormats.stock,
        title: books.title,
      })
      .from(bookFormats)
      .innerJoin(books, eq(books.bookId, bookFormats.bookId))
      .where(eq(bookFormats.bookId, bookId));

    if (rows.length === 0) {
      const [book] = await db.select({ id: books.bookId }).from(books).where(eq(books.bookId, bookId)).limit(1);
      throw book ? new BadRequestError('This book is not available to buy yet') : new NotFoundError(`Book with ID ${bookId} not found`);
    }
    if (wanted) {
      const row = rows.find((r) => r.format === wanted);
      if (!row) throw new BadRequestError(`"${rows[0].title}" isn't sold in ${wanted}`);
      return row;
    }
    const inStock = rows
      .filter((r) => r.stock > 0)
      .sort((a, b) => (a.salePriceCents ?? a.priceCents) - (b.salePriceCents ?? b.priceCents));
    if (inStock.length === 0) throw new BadRequestError(`"${rows[0].title}" is out of stock`);
    return inStock[0];
  }

  private async findItem(cartId: number, bookId: number, f: BookFormat) {
    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.bookId, bookId), eq(cartItems.format, f)))
      .limit(1);
    return item ?? null;
  }

  private assertStock(row: { title: string; stock: number; format: BookFormat }, wanted: number) {
    if (row.stock <= 0) throw new BadRequestError(`The ${row.format} of "${row.title}" is out of stock`);
    if (wanted > row.stock) {
      throw new BadRequestError(
        `Only ${row.stock} ${row.format} cop${row.stock === 1 ? 'y' : 'ies'} of "${row.title}" in stock`
      );
    }
  }

  /** The cart with prices. code = a discount code the shopper typed (optional). */
  async getCart(userId: number, code?: string | null): Promise<CartView> {
    const cart = await this.findCart(userId);
    const rows = cart
      ? await db
          .select({
            cartItemId: cartItems.cartItemId,
            bookId: cartItems.bookId,
            format: cartItems.format,
            quantity: cartItems.quantity,
            title: books.title,
            author: books.author,
            isbn: books.isbn,
            coverImageUrl: books.coverImageUrl,
            regularPriceCents: bookFormats.priceCents,
            salePriceCents: bookFormats.salePriceCents,
            stock: bookFormats.stock,
          })
          .from(cartItems)
          .innerJoin(books, eq(books.bookId, cartItems.bookId))
          // A format removed by an admin drops out of the cart instead of keeping an old price
          .innerJoin(bookFormats, and(eq(bookFormats.bookId, cartItems.bookId), eq(bookFormats.format, cartItems.format)))
          .where(eq(cartItems.cartId, cart.cartId))
          .orderBy(asc(cartItems.cartItemId))
      : [];

    const items: CartLine[] = rows.map((r) => {
      const unit = unitPrice(r);
      return { ...r, unitPriceCents: unit, onSale: r.salePriceCents !== null, lineTotalCents: unit * r.quantity };
    });

    let discount: DiscountCode | null = null;
    let discountError: string | null = null;
    if (code && code.trim()) {
      try {
        discount = await findUsableDiscount(code);
      } catch (e) {
        discountError = e instanceof Error ? e.message : 'Invalid discount code';
      }
    }

    const totals = priceOrder(items, discount);
    return {
      cartId: cart?.cartId ?? null,
      items,
      totalCount: items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalCents: totals.subtotalCents,
      totals,
      discount: discount
        ? { discountCodeId: discount.discountCodeId, code: discount.code, label: describeDiscount(discount) }
        : null,
      discountError,
    };
  }

  /** Adds a book (in a format), or increments its quantity if that line is already in the cart. */
  async addItem(userId: number, bookId: number, quantity: number, wanted?: BookFormat): Promise<CartView> {
    const row = await this.findFormatOrThrow(bookId, wanted);
    const cart = await this.findOrCreateCart(userId);
    const existing = await this.findItem(cart.cartId, bookId, row.format);
    const newQuantity = (existing?.quantity ?? 0) + quantity;
    this.assertStock(row, newQuantity);

    if (existing) {
      await db.update(cartItems).set({ quantity: newQuantity }).where(eq(cartItems.cartItemId, existing.cartItemId));
    } else {
      await db.insert(cartItems).values({ cartId: cart.cartId, bookId, format: row.format, quantity });
    }
    return this.getCart(userId);
  }

  /** Sets the exact quantity of a line that is already in the cart. */
  async setQuantity(userId: number, bookId: number, f: BookFormat, quantity: number): Promise<CartView> {
    const row = await this.findFormatOrThrow(bookId, f);
    const cart = await this.findCart(userId);
    const existing = cart ? await this.findItem(cart.cartId, bookId, f) : null;
    if (!cart || !existing) throw new NotFoundError('That book is not in your cart');
    this.assertStock(row, quantity);

    await db.update(cartItems).set({ quantity }).where(eq(cartItems.cartItemId, existing.cartItemId));
    return this.getCart(userId);
  }

  /** Removes a line (or every format of a book). Removing something that isn't there is a no-op. */
  async removeItem(userId: number, bookId: number, f?: BookFormat): Promise<CartView> {
    const cart = await this.findCart(userId);
    if (cart) {
      await db
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cart.cartId), eq(cartItems.bookId, bookId), f ? eq(cartItems.format, f) : undefined));
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
