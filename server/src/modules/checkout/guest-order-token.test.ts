import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { signGuestOrderToken, verifyGuestOrderToken, GUEST_ORDER_AUDIENCE } from './guest-order-token';
import { generateToken, verifyToken, JWT_ISSUER } from '../../shared/utils/token-util';

// Both modules read the secret when signing/verifying (not at import time), so setting it
// here is early enough.
const SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.JWT_SECRET = SECRET;

test('a valid link opens the one order it was signed for', () => {
  const token = signGuestOrderToken(4242);
  assert.equal(verifyGuestOrderToken(token), 4242);
  assert.equal(verifyGuestOrderToken(token, 4242), 4242);
});

test('an expired link is rejected', () => {
  const expired = jwt.sign({ scope: GUEST_ORDER_AUDIENCE }, SECRET, {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: GUEST_ORDER_AUDIENCE,
    subject: '4242',
    expiresIn: -60, // issued and expired a minute ago
  } as jwt.SignOptions);
  assert.throws(() => verifyGuestOrderToken(expired), /invalid or has expired/);
});

test('a tampered link is rejected', () => {
  const token = signGuestOrderToken(4242);
  const [header, payload, signature] = token.split('.');

  // Flipped signature
  const flipped = signature[0] === 'a' ? `b${signature.slice(1)}` : `a${signature.slice(1)}`;
  assert.throws(() => verifyGuestOrderToken(`${header}.${payload}.${flipped}`), /invalid or has expired/);

  // Re-pointed at another order, keeping the original signature
  const forgedBody = Buffer.from(
    JSON.stringify({
      scope: GUEST_ORDER_AUDIENCE,
      sub: '9999',
      iss: JWT_ISSUER,
      aud: GUEST_ORDER_AUDIENCE,
      exp: Math.floor(Date.now() / 1000) + 600,
    })
  ).toString('base64url');
  assert.throws(() => verifyGuestOrderToken(`${header}.${forgedBody}.${signature}`), /invalid or has expired/);

  // The right shape, signed with the wrong secret
  const wrongSecret = jwt.sign({ scope: GUEST_ORDER_AUDIENCE }, 'another-secret-that-is-also-32-chars-long', {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: GUEST_ORDER_AUDIENCE,
    subject: '4242',
    expiresIn: '30d',
  } as jwt.SignOptions);
  assert.throws(() => verifyGuestOrderToken(wrongSecret), /invalid or has expired/);

  // algorithm "none"
  const unsigned = jwt.sign({ scope: GUEST_ORDER_AUDIENCE }, '', {
    algorithm: 'none',
    issuer: JWT_ISSUER,
    audience: GUEST_ORDER_AUDIENCE,
    subject: '4242',
  } as jwt.SignOptions);
  assert.throws(() => verifyGuestOrderToken(unsigned), /invalid or has expired/);
});

test('a link signed for another order cannot open this one', () => {
  const forOrder7 = signGuestOrderToken(7);
  // It is a genuine token...
  assert.equal(verifyGuestOrderToken(forOrder7), 7);
  // ...but it is not order 8, so asking for order 8 with it fails.
  assert.throws(() => verifyGuestOrderToken(forOrder7, 8), /invalid or has expired/);
});

test('a token with the wrong audience is rejected', () => {
  // A customer sign-in token (audience "customer") is not an order link.
  const login = generateToken({ id: 1, email: 'a@example.com', role: 'customer', tv: 0 }, 'customer');
  assert.throws(() => verifyGuestOrderToken(login), /invalid or has expired/);

  // And an order link is not a sign-in token for either portal.
  const link = signGuestOrderToken(4242);
  assert.throws(() => verifyToken(link, 'customer'));
  assert.throws(() => verifyToken(link, 'staff'));

  // A well-formed token with no audience, or a made-up one, is rejected too.
  for (const audience of [undefined, 'staff', 'order']) {
    const odd = jwt.sign({ scope: GUEST_ORDER_AUDIENCE }, SECRET, {
      algorithm: 'HS256',
      issuer: JWT_ISSUER,
      subject: '4242',
      expiresIn: '30d',
      ...(audience ? { audience } : {}),
    } as jwt.SignOptions);
    assert.throws(() => verifyGuestOrderToken(odd), /invalid or has expired/);
  }
});

test('a token with no order id in it is rejected, and bad order ids are never signed', () => {
  const noSubject = jwt.sign({ scope: GUEST_ORDER_AUDIENCE }, SECRET, {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: GUEST_ORDER_AUDIENCE,
    expiresIn: '30d',
  } as jwt.SignOptions);
  assert.throws(() => verifyGuestOrderToken(noSubject), /invalid or has expired/);

  assert.throws(() => signGuestOrderToken(0));
  assert.throws(() => signGuestOrderToken(-3));
  assert.throws(() => signGuestOrderToken(1.5));
});
