import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiresCustomerSession } from './route-access';

const needs = (path: string, query = '') => requiresCustomerSession(path, new URLSearchParams(query));

test('guests can reach the checkout page', () => {
  assert.equal(needs('/checkout'), false);
  assert.equal(needs('/checkout', 'cancelled=1'), false);
});

test('a guest returning from Stripe reaches the success page that completes their order', () => {
  assert.equal(needs('/checkout/success', 'session_id=cs_test_x&guest=1'), false);
});

test('the emailed guest order link opens without an account', () => {
  assert.equal(needs('/checkout/guest-order', 'token=abc'), false);
});

test('the signed-in success page still requires a session', () => {
  assert.equal(needs('/checkout/success', 'session_id=cs_test_x'), true);
  assert.equal(needs('/checkout/success', 'session_id=cs_test_x&guest=0'), true);
  assert.equal(needs('/checkout/success'), true);
});

test('account and order pages still require a session', () => {
  assert.equal(needs('/account'), true);
  assert.equal(needs('/account/orders'), true);
  assert.equal(needs('/orders'), true);
});

test('only the exact guest pages are opened, not their siblings or look-alikes', () => {
  assert.equal(needs('/checkout/other'), true);
  assert.equal(needs('/checkout/guest-order/extra'), true);
  assert.equal(needs('/checkout-anything'), false); // not under /checkout at all
  assert.equal(needs('/checkoutx'), false);
});

test('public pages are untouched', () => {
  for (const p of ['/', '/product-catalog', '/cart', '/about', '/user-login']) assert.equal(needs(p), false);
});
