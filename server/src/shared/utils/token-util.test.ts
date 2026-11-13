import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { generateToken, verifyToken } from './token-util';

// token-util reads the secret when signing/verifying, so setting it here is early enough
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

test('a customer token verifies as a customer token', () => {
  const token = generateToken({ id: 1, email: 'a@example.com', role: 'customer', tv: 0 }, 'customer');
  assert.equal(verifyToken(token, 'customer').id, 1);
});

test('a customer token cannot open the staff portal', () => {
  const token = generateToken({ id: 1, email: 'a@example.com', role: 'customer', tv: 0 }, 'customer');
  assert.throws(() => verifyToken(token, 'staff'));
});

test('tokens signed with another secret, algorithm "none" or no issuer are rejected', () => {
  const forged = jwt.sign({ id: 1, role: 'admin', tv: 0 }, 'some-other-secret-some-other-secret', { audience: 'staff', issuer: 'bookwrms' });
  assert.throws(() => verifyToken(forged, 'staff'));
  const unsigned = jwt.sign({ id: 1, role: 'admin', tv: 0 }, '', { algorithm: 'none', audience: 'staff', issuer: 'bookwrms' } as jwt.SignOptions);
  assert.throws(() => verifyToken(unsigned, 'staff'));
  const noIssuer = jwt.sign({ id: 1, role: 'admin', tv: 0 }, process.env.JWT_SECRET!, { audience: 'staff' });
  assert.throws(() => verifyToken(noIssuer, 'staff'));
});
