// server/src/modules/cart/guest-cart-rules.ts
// What a guest cart coming from localStorage is allowed to contain, and how repeated lines are
// collapsed. Pure (no database import) so it can be unit tested — see guest-cart-rules.test.ts.
// The database-backed re-pricing lives next door in guest-cart.ts.
import { z } from 'zod';
import { BOOK_FORMATS, type BookFormat } from '../../../db/schema';

/** Most distinct lines one guest cart may contain. */
export const GUEST_CART_MAX_LINES = 20;
/** Most copies of one book-and-format, matching the signed-in cart's own cap. */
export const GUEST_CART_MAX_QUANTITY = 99;

/**
 * One line as the browser sends it: a book id, an optional format and a quantity, and nothing
 * else. `format` may be missing (the shopper clicked "add to cart" on a tile without choosing an
 * edition); the server then picks the cheapest format in stock. Any price, total or discount a
 * tampered browser adds is stripped here, because zod objects drop unknown keys.
 */
export const guestCartLineSchema = z.object({
  bookId: z.number().int().positive().max(2_147_483_647, 'Unknown book'),
  format: z.enum(BOOK_FORMATS, { message: 'format must be hardcover or paperback' }).optional(),
  quantity: z
    .number()
    .int('Quantities must be whole numbers')
    .positive('Quantities must be at least 1')
    .max(GUEST_CART_MAX_QUANTITY, `You can order up to ${GUEST_CART_MAX_QUANTITY} copies at a time`),
});

export const guestCartSchema = z
  .array(guestCartLineSchema)
  .min(1, 'Your cart is empty')
  .max(GUEST_CART_MAX_LINES, `A guest cart can hold up to ${GUEST_CART_MAX_LINES} different books`);

export type GuestCartLine = z.infer<typeof guestCartLineSchema>;

/**
 * Collapses repeated lines: the same book in the same format becomes one line whose quantity is
 * the sum, capped at GUEST_CART_MAX_QUANTITY. First-seen order is kept and the input is left
 * untouched. This is also what the cart merge on sign-in relies on, so a guest who already has
 * three copies of a book in their account cart ends up with one line, not two.
 */
export function mergeGuestLines<T extends { bookId: number; format?: BookFormat; quantity: number }>(
  lines: readonly T[]
): T[] {
  const byKey = new Map<string, T>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) continue;
    const key = `${line.bookId}:${line.format ?? ''}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = Math.min(GUEST_CART_MAX_QUANTITY, existing.quantity + line.quantity);
    } else {
      byKey.set(key, { ...line, quantity: Math.min(GUEST_CART_MAX_QUANTITY, line.quantity) });
    }
  }
  return [...byKey.values()];
}
