// End-to-end tests (SCRUM-191): a real browser walks the demo path against a production build,
// a throwaway MySQL database (see .github/workflows/ci.yml) and a fake Stripe (e2e/stripe-mock.cjs).
//
// Locally: start MySQL, point .env at an empty database, then
//   pnpm db:migrate && pnpm db:seed && E2E_PASSWORD=... E2E_TOTP_SECRET=... pnpm e2e:setup
//   pnpm build && pnpm e2e
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3300);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node e2e/stripe-mock.cjs', port: 12111, reuseExistingServer: !process.env.CI },
    {
      command: `pnpm start -p ${PORT}`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { STRIPE_SECRET_KEY: 'sk_test_e2e_fake', STRIPE_MOCK_URL: 'http://localhost:12111', STRIPE_AUTO_REFUND: 'true' },
    },
  ],
});
