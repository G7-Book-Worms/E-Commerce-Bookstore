// Stripe client (test mode only). The key comes from STRIPE_SECRET_KEY in .env and never reaches the browser.
import Stripe from 'stripe';
import { AppError } from '../../shared/errors/app-error';

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError('Payments are not set up yet (STRIPE_SECRET_KEY is missing)', 503);
  // This is a class project: refuse live keys so a real card can never be charged
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new AppError('Only Stripe test-mode keys are allowed in this project', 503);
  }
  // STRIPE_MOCK_URL (e.g. http://localhost:12111) points at a fake Stripe for automated tests only
  const mock = process.env.STRIPE_MOCK_URL ? new URL(process.env.STRIPE_MOCK_URL) : null;
  client ??= new Stripe(
    key,
    mock ? { host: mock.hostname, port: Number(mock.port), protocol: mock.protocol.replace(':', '') as 'http' | 'https' } : undefined
  );
  return client;
}

// Refund every payment right after it succeeds, unless STRIPE_AUTO_REFUND=false.
// Test-mode charges are fake anyway; this keeps the Stripe dashboard at $0 net.
export const autoRefundEnabled = () => process.env.STRIPE_AUTO_REFUND !== 'false';
