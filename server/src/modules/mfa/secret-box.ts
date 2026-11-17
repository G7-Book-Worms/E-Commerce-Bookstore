// server/src/modules/mfa/secret-box.ts
// Encrypts authenticator-app secrets before they go into the database, so a copy of the
// users/admin tables alone can't be used to generate anyone's sign-in codes.
//
// AES-256-GCM with a key derived (HKDF-SHA256) from JWT_SECRET, or from MFA_ENCRYPTION_KEY
// when that is set. Stored as "v1.<iv>.<tag>.<ciphertext>" in base64url.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

function key(): Buffer {
  const material = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material || material.length < 32) throw new Error('JWT_SECRET (or MFA_ENCRYPTION_KEY) is missing or shorter than 32 characters');
  return Buffer.from(hkdfSync('sha256', material, 'book-worms', 'mfa-secret-v1', 32));
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised sealed secret');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
