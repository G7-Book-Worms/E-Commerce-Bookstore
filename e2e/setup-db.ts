// Prepares the throwaway CI database for the end-to-end tests (run after migrate + seed).
// Never point this at a real database: it sets known passwords on the demo accounts.
//
//   - Ada (customer) and Edsger (manager) get the password in E2E_PASSWORD
//   - Edsger signs in with an authenticator app whose secret is E2E_TOTP_SECRET, so the test can
//     work out the 6-digit code itself (no email needed)
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../server/db';
import { admin, passkeys, rateLimits, users } from '../server/db/schema';
import { hashPassword } from '../server/src/shared/utils/hash-utils';
import { sealSecret } from '../server/src/modules/mfa/secret-box';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('e2e/setup-db.ts only runs against a local database');
  const password = process.env.E2E_PASSWORD;
  const secret = process.env.E2E_TOTP_SECRET;
  if (!password || !secret) throw new Error('Set E2E_PASSWORD and E2E_TOTP_SECRET');
  const hash = await hashPassword(password);
  await db.update(users).set({ passwordHash: hash, mustChangePassword: false, mfaMethod: 'none' }).where(eq(users.email, 'ada.lovelace@example.com'));
  await db.update(admin).set({ passwordHash: hash, mustChangePassword: false, mfaMethod: 'totp', totpSecret: sealSecret(secret), totpLastStep: null })
    .where(eq(admin.email, 'edsger@example.com'));
  // Start from no rate-limit counters (sign-ups are limited per IP per hour)
  await db.delete(rateLimits);
  // and no passkeys left over from an earlier run (accounts can hold 10)
  await db.delete(passkeys);
  console.log('e2e database ready');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
