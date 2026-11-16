// The customer half of the demo: browse, register, buy, see the order, look up a guest order.
import { test, expect, register, addFirstBookToCart, uniqueEmail, strongPassword } from './helpers';

test('browse: home, catalog and a product page with "You may like"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Book Worms/ }).first()).toBeVisible();
  await page.goto('/product-catalog');
  await expect(page.getByText('The Last Bookshop').first()).toBeVisible();
  await page.goto('/product/978-0-00-000000-0');
  await expect(page.getByRole('heading', { name: 'The Last Bookshop' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You may like' }).first()).toBeVisible();
  // Unknown book: the 404 page
  await page.goto('/product/978-9-99-999999-9');
  await expect(page.getByText(/not found|couldn.t find/i).first()).toBeVisible();
});

test('a new customer registers, buys a book and sees the order', async ({ page }) => {
  const email = uniqueEmail('buyer');
  await register(page, email, strongPassword());
  await addFirstBookToCart(page);

  await page.goto('/cart');
  await expect(page.getByText('Order summary')).toBeVisible();
  await page.getByRole('link', { name: /checkout/i }).click();
  await expect(page).toHaveURL(/\/checkout$/, { timeout: 20_000 });

  // First order: add a shipping address
  await page.getByLabel('Full name').fill('Test Reader');
  await page.getByLabel('Street').fill('1 UTSA Circle');
  await page.getByLabel('City').fill('San Antonio');
  await page.getByLabel('State').fill('TX');
  await page.getByLabel('ZIP code').fill('78249');
  await page.getByLabel('Country').fill('United States');
  await page.getByRole('button', { name: 'Save address' }).click();

  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 30_000 });
  await expect(page.getByText(/thank you/i).first()).toBeVisible();
  await expect(page.getByText(/ending 4242/).first()).toBeVisible();

  await page.goto('/account?tab=orders');
  await expect(page.getByText(/Order #\d+/).first()).toBeVisible();
});

test('a guest checks out and finds the order with its number and email', async ({ page }) => {
  await addFirstBookToCart(page);
  await page.goto('/checkout');
  await page.getByText('Continue as guest').click();

  const email = uniqueEmail('guest');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Full name').fill('Guest Reader');
  await page.getByLabel('Street').fill('2 Main Plaza');
  await page.getByLabel('City').fill('San Antonio');
  await page.getByLabel('State').fill('TX');
  await page.getByLabel('ZIP code').fill('78205');
  await page.getByLabel('Country').fill('United States');
  await page.getByRole('button', { name: /^Pay / }).click();
  await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 30_000 });
  await expect(page.getByText(/thank you/i).first()).toBeVisible();
  const orderNumber = (await page.getByText(/#\d+/).first().innerText()).match(/#(\d+)/)?.[1];
  expect(orderNumber).toBeTruthy();

  // Wrong email: same answer as a wrong number
  await page.goto('/checkout/guest-order');
  await page.getByLabel('Order number').fill(orderNumber!);
  await page.getByLabel('Email address').fill('someone-else@example.test');
  await page.getByRole('button', { name: 'Show my order' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /couldn.t find/i })).toBeVisible();

  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Show my order' }).click();
  await expect(page.getByRole('heading', { name: `Order #${orderNumber}` })).toBeVisible();
});

test('a customer downloads their data and deletes their account', async ({ page }) => {
  const email = uniqueEmail('leaver');
  const password = strongPassword();
  await register(page, email, password);

  const res = await page.request.get('/api/users/my-data');
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.profile.email).toBe(email);
  expect(JSON.stringify(data)).not.toMatch(/passwordHash|\$2[aby]\$/);

  await page.goto('/account?tab=security');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('textbox', { name: /Your password/ }).fill(password);
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByRole('button', { name: /delete my account forever/i }).click();
  await expect(page).toHaveURL(/account=deleted/, { timeout: 20_000 });
  await expect(page.getByText(/Your account was deleted and you/).first()).toBeVisible();

  const login = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(login.status()).toBe(401);
});
