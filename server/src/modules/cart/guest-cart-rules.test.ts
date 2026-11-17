import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeGuestLines,
  guestCartSchema,
  guestCartLineSchema,
  GUEST_CART_MAX_LINES,
  GUEST_CART_MAX_QUANTITY,
} from './guest-cart-rules';

// --- merging (used both for a guest's own cart and for the merge on sign-in) ---

test('the same book and format becomes one line with the quantities summed', () => {
  const merged = mergeGuestLines([
    { bookId: 1, format: 'paperback', quantity: 2 },
    { bookId: 1, format: 'paperback', quantity: 3 },
  ]);
  assert.deepEqual(merged, [{ bookId: 1, format: 'paperback', quantity: 5 }]);
});

test('the same book in different formats stays two lines', () => {
  const merged = mergeGuestLines([
    { bookId: 1, format: 'paperback', quantity: 1 },
    { bookId: 1, format: 'hardcover', quantity: 1 },
  ]);
  assert.equal(merged.length, 2);
});

test('first-seen order is kept', () => {
  const merged = mergeGuestLines([
    { bookId: 9, format: 'paperback', quantity: 1 },
    { bookId: 3, format: 'hardcover', quantity: 1 },
    { bookId: 9, format: 'paperback', quantity: 1 },
  ]);
  assert.deepEqual(merged.map((l) => l.bookId), [9, 3]);
});

test('a summed quantity is capped instead of overflowing', () => {
  const merged = mergeGuestLines([
    { bookId: 1, format: 'paperback', quantity: 90 },
    { bookId: 1, format: 'paperback', quantity: 90 },
  ]);
  assert.deepEqual(merged, [{ bookId: 1, format: 'paperback', quantity: GUEST_CART_MAX_QUANTITY }]);
});

test('lines with no quantity, a zero, a negative or a fraction are dropped', () => {
  const merged = mergeGuestLines([
    { bookId: 1, format: 'paperback', quantity: 0 },
    { bookId: 2, format: 'paperback', quantity: -5 },
    { bookId: 3, format: 'paperback', quantity: 1.5 },
    { bookId: 4, format: 'paperback', quantity: Number.NaN },
    { bookId: 5, format: 'paperback', quantity: 1 },
  ]);
  assert.deepEqual(merged, [{ bookId: 5, format: 'paperback', quantity: 1 }]);
});

test('a line with no format is kept separate until the server resolves it', () => {
  const merged = mergeGuestLines([
    { bookId: 1, quantity: 1 },
    { bookId: 1, format: 'paperback', quantity: 1 },
  ]);
  assert.equal(merged.length, 2);
});

test('merging does not mutate the lines it was given', () => {
  const input = [
    { bookId: 1, format: 'paperback' as const, quantity: 2 },
    { bookId: 1, format: 'paperback' as const, quantity: 2 },
  ];
  mergeGuestLines(input);
  assert.deepEqual(input.map((l) => l.quantity), [2, 2]);
});

// --- validation of what the browser sends ---

test('a sane guest cart is accepted', () => {
  const parsed = guestCartSchema.parse([
    { bookId: 12, format: 'hardcover', quantity: 2 },
    { bookId: 13, quantity: 1 },
  ]);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[1].format, undefined);
});

test('absurd quantities are rejected before they can reach Stripe', () => {
  for (const quantity of [0, -1, 1.5, 100, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(guestCartLineSchema.safeParse({ bookId: 1, format: 'paperback', quantity }).success, false, `quantity ${quantity} should be rejected`);
  }
  assert.equal(guestCartLineSchema.safeParse({ bookId: 1, format: 'paperback', quantity: GUEST_CART_MAX_QUANTITY }).success, true);
});

test('bad book ids and made-up formats are rejected', () => {
  assert.equal(guestCartLineSchema.safeParse({ bookId: 0, quantity: 1 }).success, false);
  assert.equal(guestCartLineSchema.safeParse({ bookId: -4, quantity: 1 }).success, false);
  assert.equal(guestCartLineSchema.safeParse({ bookId: 2.5, quantity: 1 }).success, false);
  assert.equal(guestCartLineSchema.safeParse({ bookId: '1', quantity: 1 }).success, false);
  assert.equal(guestCartLineSchema.safeParse({ bookId: 1, format: 'audiobook', quantity: 1 }).success, false);
});

test('prices and totals sent by the browser are ignored, not trusted', () => {
  const parsed = guestCartLineSchema.parse({
    bookId: 1,
    format: 'paperback',
    quantity: 1,
    unitPriceCents: 1,
    lineTotalCents: 1,
    discountCents: 99999,
  } as unknown);
  assert.deepEqual(parsed, { bookId: 1, format: 'paperback', quantity: 1 });
});

test('an empty cart and an over-long cart are both rejected', () => {
  assert.equal(guestCartSchema.safeParse([]).success, false);
  const tooMany = Array.from({ length: GUEST_CART_MAX_LINES + 1 }, (_, i) => ({ bookId: i + 1, quantity: 1 }));
  assert.equal(guestCartSchema.safeParse(tooMany).success, false);
});
