// The staff half of the demo, after shopping.spec.ts has placed orders: ship an order with a
// tracking number, and restock a book.
import { test, expect, staffSignIn, PASSWORD, TOTP_SECRET } from './helpers';

test.beforeEach(async ({ page }) => {
  test.skip(!PASSWORD || !TOTP_SECRET, 'needs E2E_PASSWORD and E2E_TOTP_SECRET');
  await staffSignIn(page);
});

test('staff ship the newest order (the guest order) with a UPS tracking number', async ({ page }) => {
  await page.goto('/admin/orders');
  const first = page.locator('a[href^="/admin/orders/"]').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/admin\/orders\/\d+/);

  const ship = page.getByRole('button', { name: 'Mark as shipped' });
  // The newest order is the guest order shopping.spec.ts just placed, so it is waiting to ship
  await expect(ship).toBeVisible();
  await page.getByLabel('Carrier').selectOption('ups');
  await page.getByLabel('Tracking number').fill('1Z999AA10123456784');
  await ship.click();
  await expect(page.getByText(/1Z999AA10123456784/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as delivered' })).toBeVisible();
});

test('staff restock a book and the change is recorded', async ({ page }) => {
  await page.goto('/admin/inventory');
  await page.getByRole('button', { name: 'Stock', exact: true }).first().click();
  await page.getByLabel('Copies received').fill('5');
  await page.getByPlaceholder('Supplier delivery').fill('e2e delivery');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect(page.getByRole('status').first()).toHaveClass(/text-green-800/);
  await page.reload();
  await expect(page.getByText('Recent stock changes')).toBeVisible();
  await expect(page.getByText('“e2e delivery”').first()).toBeVisible();
});
