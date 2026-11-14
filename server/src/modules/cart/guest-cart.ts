// server/src/modules/cart/guest-cart.ts
// Guest (not signed in) carts live in the visitor's localStorage, so every line that arrives
// from the browser is untrusted: it carries only a book id, an optional format and a quantity.
// Titles, prices, sale prices, stock and all totals are looked up here, on the server, exactly
// like CartService.getCart does for a signed-in shopper. SCRUM-208.
//
// The validation rules and the pure line-merging live in guest-cart-rules.ts (no database
// import, so they can be unit tested).
import { inArray, eq } from 'drizzle-orm';
import { db } from '../../../db';
import { books, bookFormats, type BookFormat, type DiscountCode } from '../../../db/schema';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error';
import { priceOrder, unitPrice, describeDiscount } from './pricing';
import { findUsableDiscount } from '../discounts/discounts-repository';
import { mergeGuestLines, type GuestCartLine } from './guest-cart-rules';
import type { CartLine, CartView } from './cart-service';

export {
  GUEST_CART_MAX_LINES,
  GUEST_CART_MAX_QUANTITY,
  guestCartLineSchema,
  guestCartSchema,
  mergeGuestLines,
  type GuestCartLine,
} from './guest-cart-rules';

type FormatRow = {
  bookId: number;
  format: BookFormat;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  title: string;
  author: string;
  isbn: string;
  coverImageUrl: string | null;
};

/** Every format currently sold for these books, with today's prices and stock. */
async function loadFormats(bookIds: number[]): Promise<FormatRow[]> {
  if (bookIds.length === 0) return [];
  return db
    .select({
      bookId: bookFormats.bookId,
      format: bookFormats.format,
      priceCents: bookFormats.priceCents,
      salePriceCents: bookFormats.salePriceCents,
      stock: bookFormats.stock,
      title: books.title,
      author: books.author,
      isbn: books.isbn,
      coverImageUrl: books.coverImageUrl,
    })
    .from(bookFormats)
    .innerJoin(books, eq(books.bookId, bookFormats.bookId))
    .where(inArray(bookFormats.bookId, bookIds));
}

/** The edition being bought. No format given = the cheapest one in stock (as CartService does). */
function resolveFormat(rows: FormatRow[], wanted: BookFormat | undefined): FormatRow {
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

/**
 * Prices a guest cart from scratch: resolves each line to a real format, re-reads the price and
 * stock from book_formats, re-validates any discount code (active, started, not expired, under
 * its usage limit) and returns the same shape the signed-in cart returns, so the checkout UI can
 * render it unchanged.
 *
 * Nothing the browser sent about money, titles or stock is used.
 */
export async function priceGuestCart(rawLines: GuestCartLine[], code?: string | null): Promise<CartView> {
  const requested = mergeGuestLines(rawLines);
  const rows = await loadFormats([...new Set(requested.map((l) => l.bookId))]);

  // Resolve every line to a concrete format first, then merge again: "no format" and an explicit
  // format can resolve to the same edition and must become one line, not two.
  const resolved = requested.map((line) => {
    const forBook = rows.filter((r) => r.bookId === line.bookId);
    if (forBook.length === 0) throw new NotFoundError(`A book in your cart is no longer available`);
    return { ...line, format: resolveFormat(forBook, line.format).format };
  });

  const items: CartLine[] = mergeGuestLines(resolved).map((line, index) => {
    const row = rows.find((r) => r.bookId === line.bookId && r.format === line.format)!;
    const unit = unitPrice({
      quantity: line.quantity,
      regularPriceCents: row.priceCents,
      salePriceCents: row.salePriceCents,
    });
    return {
      // Guest lines have no cart_items row; the UI only needs a stable key per line.
      cartItemId: index + 1,
      bookId: row.bookId,
      format: row.format,
      quantity: line.quantity,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      coverImageUrl: row.coverImageUrl,
      regularPriceCents: row.priceCents,
      salePriceCents: row.salePriceCents,
      unitPriceCents: unit,
      onSale: row.salePriceCents !== null,
      stock: row.stock,
      lineTotalCents: unit * line.quantity,
    };
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
    cartId: null,
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

/** Throws the same "lower the quantity" errors the signed-in checkout throws. */
export function assertGuestCartInStock(items: CartLine[]): void {
  for (const line of items) {
    if (line.quantity > line.stock) {
      throw new BadRequestError(
        line.stock === 0
          ? `The ${line.format} of "${line.title}" just sold out. Remove it to continue.`
          : `Only ${line.stock} ${line.format} copies of "${line.title}" are left. Lower the quantity to continue.`
      );
    }
  }
}
