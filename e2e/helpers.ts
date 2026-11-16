import { createHmac } from 'node:crypto';
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
  // The page does a full navigation once signed up
  await expect(page).not.toHaveURL(/\/user-register/, { timeout: 20_000 });
  await page.waitForLoadState();
}

export async function addFirstBookToCart(page: Page) {
  await page.goto('/product/978-0-00-000000-0');
  await page.getByRole('button', { name: /add to cart/i }).first().click();
  await expect(page.getByText(/added/i).first()).toBeVisible();
}
