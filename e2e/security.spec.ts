// Sign-in security: passkeys (with Chrome's virtual authenticator), the staff portal with an
// authenticator-app code, and staff-only pages refusing customers.
import { test, expect, staffSignIn, PASSWORD, TOTP_SECRET } from './helpers';

test('a customer adds a passkey and signs in with it', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  // Ada (password set by e2e/setup-db.ts) keeps the number of sign-ups under the hourly limit
  test.skip(!PASSWORD, 'needs E2E_PASSWORD');
  const email = 'ada.lovelace@example.com';
  const password = PASSWORD;
  await page.goto('/user-login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).not.toHaveURL(/\/user-login/, { timeout: 20_000 });
  await page.goto('/account?tab=security');
  await page.getByRole('button', { name: /add a passkey/i }).click();
  await page.getByRole('textbox', { name: /Your password/ }).fill(password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(/passkey added/i)).toBeVisible();

  await context.clearCookies();
  await page.goto('/user-login');
  await page.getByRole('button', { name: /sign in with a passkey/i }).click();
  await expect(page).not.toHaveURL(/\/user-login/, { timeout: 20_000 });
  const me = await (await page.request.get('/api/auth/me')).json();
  expect(me.data.user.email).toBe(email);

  // The same passkey must not open the staff portal
  await context.clearCookies();
  await page.goto('/staff-login');
  await page.getByRole('button', { name: /sign in with a passkey/i }).click();
  await expect(page.getByText(/didn't work here/)).toBeVisible();
});

test('staff sign in with an authenticator code and see the dashboard', async ({ page }) => {
  test.skip(!PASSWORD || !TOTP_SECRET, 'needs E2E_PASSWORD and E2E_TOTP_SECRET');
  await staffSignIn(page);
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.goto('/admin/orders');
  await expect(page.getByRole('table').first()).toBeVisible();
  await page.goto('/admin/activity');
  await expect(page.getByText(/Security/).first()).toBeVisible();
});

test('customers and visitors are kept out of the staff portal', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/staff-login/, { timeout: 20_000 });
  test.skip(!PASSWORD, 'needs E2E_PASSWORD');
  const login = await page.request.post('/api/auth/login', { data: { email: 'ada.lovelace@example.com', password: PASSWORD } });
  expect(login.status()).toBe(200);
  const res = await page.request.post('/api/staff/discounts', { data: {} });
  expect([401, 403]).toContain(res.status());
});
