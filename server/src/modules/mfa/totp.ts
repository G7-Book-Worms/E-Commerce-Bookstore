// server/src/modules/mfa/totp.ts
// Time-based one-time passwords (RFC 6238), the codes authenticator apps such as Google
// Authenticator, Microsoft Authenticator, 1Password or Authy show: HMAC-SHA1, 6 digits, 30 s.
//
// Written out here instead of pulling in a library because it is ~60 lines of standard
// cryptography and the RFC test vectors in totp.test.ts pin it down.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random secret (160 bits, the size RFC 4226 recommends), base32 for the app. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The 30-second window a moment falls in. */
export function totpStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** HOTP (RFC 4226) for one counter value. `digits` is 6 for apps; the RFC vectors use 8. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS, algorithm: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algorithm, secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function totpCode(secretBase32: string, nowMs = Date.now()): string {
  return hotp(base32Decode(secretBase32), totpStep(nowMs));
}

/**
 * Checks a code against the current window and one either side (phone clocks drift).
 * Returns the window that matched so the caller can store it and refuse that window and any
 * earlier one next time (a code can't be replayed), or null when it doesn't match.
 */
export function verifyTotp(secretBase32: string, code: string, lastUsedStep: number | null, nowMs = Date.now()): number | null {
  const digits = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const secret = base32Decode(secretBase32);
  const now = totpStep(nowMs);
  for (const step of [now - 1, now, now + 1]) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(digits))) return step;
  }
  return null;
}

/** The otpauth:// link an authenticator app reads from the QR code. */
export function totpUri(secretBase32: string, accountName: string, issuer = 'Book Worms'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
