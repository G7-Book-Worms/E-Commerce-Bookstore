// Turns what someone typed into a cart quantity box into a number we can send, or a reason not to.
// Shared by the cart page and the quantity stepper on book tiles and the product page.

/** Most copies of one book (one edition) a cart line may hold. */
export const MAX_PER_LINE = 99;

export type QuantityResult =
  | { ok: true; value: number; clampedTo?: number }
  | { ok: false; reason: string };

/**
 * - Only whole numbers: "", "abc", "2.5", "-1", "1e3" and other NaN-ish input are refused.
 * - 0 means "remove this line".
 * - More than is in stock (or more than 99) is lowered to the most allowed, and says so.
 */
export function parseQuantity(raw: string, stock: number): QuantityResult {
  const text = raw.trim();
  if (text === '') return { ok: false, reason: 'Enter how many copies you want.' };
  if (!/^\d+$/.test(text)) return { ok: false, reason: 'Enter a whole number of copies, like 1 or 2.' };
  const n = Number(text);
  if (!Number.isSafeInteger(n) && text.length > 15) {
    // Absurdly long digit strings: treat as "as many as possible"
    return limit(stock);
  }
  if (n === 0) return { ok: true, value: 0 };
  const max = Math.min(MAX_PER_LINE, Math.max(0, Math.floor(stock)));
  if (max <= 0) return { ok: false, reason: 'This edition is out of stock.' };
  if (n > max) return { ok: true, value: max, clampedTo: max };
  return { ok: true, value: n };
}

function limit(stock: number): QuantityResult {
  const max = Math.min(MAX_PER_LINE, Math.max(0, Math.floor(stock)));
  return max > 0 ? { ok: true, value: max, clampedTo: max } : { ok: false, reason: 'This edition is out of stock.' };
}

/** "Only 3 paperback copies are in stock." / "You can add up to 99 copies." */
export function limitMessage(max: number, edition?: string): string {
  if (max >= MAX_PER_LINE) return `You can add up to ${MAX_PER_LINE} copies of one book.`;
  const what = edition ? `${edition.toLowerCase()} ` : '';
  return max === 1 ? `Only 1 ${what}copy is in stock.` : `Only ${max} ${what}copies are in stock.`;
}
