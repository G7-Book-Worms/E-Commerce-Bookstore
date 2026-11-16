import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

export const PASSWORD = process.env.E2E_PASSWORD ?? '';
export const TOTP_SECRET = process.env.E2E_TOTP_SECRET ?? '';

/** Every page starts with the class-project notice already dismissed. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('bw-demo-notice-v1', '1'); } catch {}
    });
    await use(page);
  },
});
export { expect };

/** RFC 6238 code for the e2e staff account (same maths as server/src/modules/mfa/totp.ts). */
export function totp(secretBase32: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretBase32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;
export const strongPassword = () => `E2e!${Math.random().toString(36).slice(2, 10)}Zz9#`;

export async function register(page: Page, email: string, password: string, first = 'Test', last = 'Reader') {
  await page.goto('/user-register');
  await page.fill('#firstName', first);
  await page.fill('#lastName', last);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.fill('#confirmPassword', password);
  await page.getByRole('button', { name: /create account|sign up|register/i }).click();
  // Step 2: the 6-digit code emailed to the address
  await expect(page.getByRole('heading', { name: /confirm your email/i })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel(/confirmation code/i).fill(await emailedCode(email));
  await page.getByRole('button', { name: /confirm and create account/i }).click();
  // The page does a full navigation once signed up
  await expect(page).not.toHaveURL(/\/user-register/, { timeout: 20_000 });
  await page.waitForLoadState();
}

/** The newest 6-digit code emailed to `to` (the test server writes its mail to E2E_MAILBOX). */
export async function emailedCode(to: string): Promise<string> {
  const file = process.env.E2E_MAILBOX ?? '';
  for (let i = 0; i < 40; i++) {
    if (file && existsSync(file)) {
      const mail = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as { to: string; text: string })
        .filter((m) => m.to === to).pop();
      const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No code was emailed to ${to}`);
}

export async function addFirstBookToCart(page: Page) {
  await page.goto('/product/978-0-00-000000-0');
  await page.getByRole('button', { name: /add to cart/i }).first().click();
  await expect(page.getByText(/added/i).first()).toBeVisible();
}

/**
 * Signs in the e2e staff account (Edsger, manager) with the authenticator code. A code works once
 * per 30-second window, so if another test just used this window's code, wait for the next one.
 */
export async function staffSignIn(page: Page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/staff-login');
    await page.getByLabel('Work email').fill('edsger@example.com');
    await page.getByLabel('Employee ID').fill('BW-1002');
    await page.locator('#staff-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const code = page.getByRole('textbox').first();
    await expect(code).toBeVisible();
    await code.fill(totp(TOTP_SECRET));
    await page.keyboard.press('Enter');
    const ok = await page.waitForURL(/\/admin/, { timeout: 8_000, waitUntil: 'commit' }).then(() => true, () => false);
    if (ok) return;
    await page.waitForTimeout(31_000 - (Date.now() % 30_000));
  }
  throw new Error('staff sign-in failed');
}
