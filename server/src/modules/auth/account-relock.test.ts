import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { readRelockToken, signRelockToken } from './relock-token';

process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-thirty-two-characters';

test('a relock link names the account it was sent for', () => {
  const a = readRelockToken(signRelockToken('customer', 42));
  assert.equal(a.kind, 'customer'); assert.equal(a.id, 42); assert.match(a.jti, /^[0-9a-f]{32}$/);
  const b = readRelockToken(signRelockToken('staff', 7));
  assert.equal(b.kind, 'staff'); assert.equal(b.id, 7);
  // every link has its own id, so using one never spends another
  assert.notEqual(a.jti, readRelockToken(signRelockToken('customer', 42)).jti);
});

test('forged, other-purpose, expired or missing links are refused', () => {
  const s = process.env.JWT_SECRET!;
  assert.throws(() => readRelockToken(jwt.sign({ k: 'customer' }, 'another-secret-that-is-long-enough-123', { issuer: 'bookwrms', audience: 'account-relock', subject: '1' })));
  assert.throws(() => readRelockToken(jwt.sign({ k: 'customer' }, s, { issuer: 'bookwrms', audience: 'mfa-pending', subject: '1' })));
  assert.throws(() => readRelockToken(jwt.sign({ k: 'customer', exp: Math.floor(Date.now() / 1000) - 10 }, s, { issuer: 'bookwrms', audience: 'account-relock', subject: '1' })));
  assert.throws(() => readRelockToken(undefined));
  // A link without its own id is refused
  assert.throws(() => readRelockToken(jwt.sign({ k: 'customer' }, s, { issuer: 'bookwrms', audience: 'account-relock', subject: '1' })));
  assert.throws(() => readRelockToken('x'.repeat(3000)));
});
