import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCartFormat, type CatalogFormat } from './catalog';

const fmt = (format: CatalogFormat['format'], priceCents: number, stock: number, salePriceCents: number | null = null): CatalogFormat =>
  ({ format, priceCents, salePriceCents, stock });

test('picks the cheaper edition when both are in stock', () => {
  assert.equal(defaultCartFormat({ formats: [fmt('hardcover', 1899, 5), fmt('paperback', 799, 12)] }), 'paperback');
});

test('a sale price counts: a discounted hardcover can be the cheapest', () => {
  assert.equal(defaultCartFormat({ formats: [fmt('hardcover', 1899, 5, 599), fmt('paperback', 799, 12)] }), 'hardcover');
});

test('skips an edition that is sold out even if it is cheaper', () => {
  assert.equal(defaultCartFormat({ formats: [fmt('hardcover', 1899, 5), fmt('paperback', 799, 0)] }), 'hardcover');
});

test('null when every edition is sold out', () => {
  assert.equal(defaultCartFormat({ formats: [fmt('hardcover', 1899, 0), fmt('paperback', 799, 0)] }), null);
});

test('null for a book with no editions', () => {
  assert.equal(defaultCartFormat({ formats: [] }), null);
});
