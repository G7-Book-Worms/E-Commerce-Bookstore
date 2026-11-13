// Run with: pnpm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceOrder, discountFor, TAX_RATE } from './pricing';

const book = (regular: number, sale: number | null = null, quantity = 1) => ({
  regularPriceCents: regular,
  salePriceCents: sale,
  quantity,
});

test('tax is 8.25% of the subtotal', () => {
  assert.equal(TAX_RATE, 0.0825);
  const t = priceOrder([book(1000)], null);
  assert.deepEqual(t, { subtotalCents: 1000, saleSavingsCents: 0, discountCents: 0, taxCents: 83, totalCents: 1083 });
});

test('sale prices are charged and the savings are reported', () => {
  const t = priceOrder([book(2000, 1500, 2)], null);
  assert.equal(t.subtotalCents, 3000);
  assert.equal(t.saleSavingsCents, 1000);
  assert.equal(t.taxCents, 248); // 3000 * 0.0825 = 247.5 -> rounds up
  assert.equal(t.totalCents, 3248);
});

test('percent codes come off before tax', () => {
  const t = priceOrder([book(1999), book(799, 599)], { code: 'BOOKWORMS10', percentOff: 10, amountOffCents: null });
  assert.equal(t.subtotalCents, 2598);
  assert.equal(t.discountCents, 260); // 259.8 -> 260
  assert.equal(t.taxCents, 193); // (2598 - 260) * 0.0825 = 192.885 -> 193
  assert.equal(t.totalCents, 2598 - 260 + 193);
});

test('fixed-amount codes never push the order below zero', () => {
  assert.equal(discountFor(300, { code: 'WELCOME5', percentOff: null, amountOffCents: 500 }), 300);
  const t = priceOrder([book(300)], { code: 'WELCOME5', percentOff: null, amountOffCents: 500 });
  assert.equal(t.totalCents, 0);
});

test('an empty cart costs nothing', () => {
  assert.equal(priceOrder([], { code: 'X', percentOff: 50, amountOffCents: null }).totalCents, 0);
});
