import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import * as v from './email-verification';

// Read when a code is hashed or signed, so setting it here is early enough
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-thirty-two-characters';

const details = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', phone: null, passwordHash: '$2b$12$hash' };

test('the right code matches, a wrong one does not', () => {
  const p = v.withCode(details, '123456');
  assert.equal(v.codeMatches(p, '123456'), true);
  assert.equal(v.codeMatches(p, '123 456'), true);
  assert.equal(v.codeMatches(p, '654321'), false);
  assert.equal(v.codeMatches(p, 'abc'), false);
});

test('the signed cookie round-trips and does not contain the code', () => {
  const p = v.withCode(details, '987654');
  const token = v.signPendingRegistration(p);
  assert.ok(!token.includes('987654'));
  assert.ok(!JSON.stringify(jwt.decode(token)).includes('987654'));
  const back = v.readPendingRegistration(token);
  assert.equal(back.email, 'ada@example.test');
  assert.equal(v.codeMatches(back, '987654'), true);
});

test('a tampered or missing cookie is refused', () => {
  const token = v.signPendingRegistration(v.withCode(details, '111111'));
  const [h, , s] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ reg: { ...details, email: 'eve@example.test', codeHash: 'x', nonce: 'y' } })).toString('base64url');
  assert.throws(() => v.readPendingRegistration(`${h}.${forged}.${s}`));
  assert.throws(() => v.readPendingRegistration(undefined));
});

test('each code gets its own nonce, so the same code hashes differently', () => {
  const a = v.withCode(details, '222222');
  const b = v.withCode(details, '222222');
  assert.notEqual(a.codeHash, b.codeHash);
});
