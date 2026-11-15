import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSecret, sealSecret } from './secret-box';

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-the-check-0123456789';

test('round-trips and never stores the plain secret', () => {
  const sealed = sealSecret('JBSWY3DPEHPK3PXP');
  assert.ok(sealed.startsWith('v1.'));
  assert.ok(!sealed.includes('JBSWY3DPEHPK3PXP'));
  assert.equal(openSecret(sealed), 'JBSWY3DPEHPK3PXP');
});

test('the same secret seals differently each time', () => {
  assert.notEqual(sealSecret('abc'), sealSecret('abc'));
});

test('a tampered value is refused', () => {
  const [v, iv, tag, data] = sealSecret('JBSWY3DPEHPK3PXP').split('.');
  const flipped = Buffer.from(data, 'base64url');
  flipped[0] ^= 1;
  assert.throws(() => openSecret([v, iv, tag, flipped.toString('base64url')].join('.')));
  assert.throws(() => openSecret('not-sealed'));
});

test('a different key cannot open it', () => {
  const sealed = sealSecret('JBSWY3DPEHPK3PXP');
  process.env.MFA_ENCRYPTION_KEY = 'another-key-that-is-also-long-enough-0123456789';
  try {
    assert.throws(() => openSecret(sealed));
  } finally {
    delete process.env.MFA_ENCRYPTION_KEY;
  }
});
