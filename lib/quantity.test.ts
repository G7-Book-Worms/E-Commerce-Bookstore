import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limitMessage, parseQuantity } from './quantity';

test('whole numbers within stock pass through', () => {
  assert.deepEqual(parseQuantity('3', 10), { ok: true, value: 3 });
  assert.deepEqual(parseQuantity(' 007 ', 10), { ok: true, value: 7 });
});

test('NaN-ish, decimal, negative and empty input is refused', () => {
  for (const bad of ['', '   ', 'abc', 'NaN', '2.5', '-1', '1e3', '0x10', '½', '3 copies']) {
    assert.equal(parseQuantity(bad, 10).ok, false, bad);
  }
});

test('more than in stock is lowered to the stock', () => {
  assert.deepEqual(parseQuantity('50', 4), { ok: true, value: 4, clampedTo: 4 });
  assert.deepEqual(parseQuantity('99999999999999999999', 4), { ok: true, value: 4, clampedTo: 4 });
});

test('never more than 99 per line, even with more in stock', () => {
  assert.deepEqual(parseQuantity('150', 500), { ok: true, value: 99, clampedTo: 99 });
});

test('0 means remove; out of stock refuses anything else', () => {
  assert.deepEqual(parseQuantity('0', 5), { ok: true, value: 0 });
  assert.equal(parseQuantity('2', 0).ok, false);
});

test('limit messages read naturally', () => {
  assert.equal(limitMessage(1, 'Paperback'), 'Only 1 paperback copy is in stock.');
  assert.equal(limitMessage(4, 'Hardcover'), 'Only 4 hardcover copies are in stock.');
  assert.equal(limitMessage(99), 'You can add up to 99 copies of one book.');
});
