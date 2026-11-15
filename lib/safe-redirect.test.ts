import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeInternalPath } from './safe-redirect';

test('keeps paths on this site', () => {
  for (const p of ['/', '/checkout', '/account?tab=orders', '/product/978-0?x=1#y']) assert.equal(safeInternalPath(p), p);
});

test('refuses anything that leaves the site', () => {
  for (const p of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'evil.com', 'javascript:alert(1)', '/\tevil', '', null, undefined]) {
    assert.equal(safeInternalPath(p as string), '/', String(p));
  }
});

test('a required prefix keeps staff redirects inside the portal', () => {
  assert.equal(safeInternalPath('/admin/orders', '/admin', '/admin'), '/admin/orders');
  assert.equal(safeInternalPath('/admin', '/admin', '/admin'), '/admin');
  assert.equal(safeInternalPath('/administrator', '/admin', '/admin'), '/admin');
  assert.equal(safeInternalPath('/account', '/admin', '/admin'), '/admin');
});
