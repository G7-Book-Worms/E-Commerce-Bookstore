import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode, generateTotpSecret, hotp, totpCode, totpStep, totpUri, verifyTotp } from './totp';

// RFC 4226 appendix D: secret "12345678901234567890", 6-digit HOTP for counters 0..9
const RFC_SECRET = Buffer.from('12345678901234567890');
const RFC_HOTP = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

test('HOTP matches the RFC 4226 test vectors', () => {
  RFC_HOTP.forEach((code, counter) => assert.equal(hotp(RFC_SECRET, counter), code));
});

test('TOTP matches the RFC 6238 SHA-1 test vectors (8 digits)', () => {
  const vectors: [number, string][] = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']];
  for (const [seconds, code] of vectors) assert.equal(hotp(RFC_SECRET, Math.floor(seconds / 30), 8), code);
});

test('base32 round-trips and matches the RFC 4648 example', () => {
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
  assert.equal(base32Decode('MZXW6YTBOI').toString(), 'foobar');
  assert.equal(base32Decode('mzxw 6ytb oi====').toString(), 'foobar');
  const secret = generateTotpSecret();
  assert.equal(secret.length, 32);
  assert.equal(base32Encode(base32Decode(secret)), secret);
});

test('a current code verifies and reports its window', () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;
  assert.equal(verifyTotp(secret, totpCode(secret, now), null, now), totpStep(now));
});

test('codes from the neighbouring windows are accepted, older ones are not', () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;
  assert.notEqual(verifyTotp(secret, totpCode(secret, now - 30_000), null, now), null);
  assert.notEqual(verifyTotp(secret, totpCode(secret, now + 30_000), null, now), null);
  assert.equal(verifyTotp(secret, totpCode(secret, now - 90_000), null, now), null);
});

test('a code cannot be used twice', () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;
  const step = verifyTotp(secret, totpCode(secret, now), null, now);
  assert.notEqual(step, null);
  assert.equal(verifyTotp(secret, totpCode(secret, now), step, now), null);
});

test('rejects malformed input and the wrong code', () => {
  const secret = generateTotpSecret();
  const now = 1_800_000_000_000;
  const good = totpCode(secret, now);
  const wrong = String((Number(good) + 1) % 1_000_000).padStart(6, '0');
  for (const bad of ['', '12345', '1234567', 'abcdef', wrong]) assert.equal(verifyTotp(secret, bad, null, now), null);
  assert.notEqual(verifyTotp(secret, `${good.slice(0, 3)} ${good.slice(3)}`, null, now), null);
});

test('otpauth URI carries the issuer, account and secret', () => {
  const uri = totpUri('JBSWY3DPEHPK3PXP', 'ada@example.com');
  assert.match(uri, /^otpauth:\/\/totp\/Book%20Worms%3Aada%40example\.com\?/);
  assert.match(uri, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(uri, /issuer=Book\+Worms/);
});
