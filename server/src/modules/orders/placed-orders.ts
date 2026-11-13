import { sql } from 'drizzle-orm';

// An order row is created when checkout starts, before the shopper pays on Stripe.
// "Placed" orders are every order except those whose Stripe payment never completed
// (abandoned or failed checkouts). Older/seeded orders without a Stripe payment count as placed.
export const isPlacedOrder = sql`NOT EXISTS (
  SELECT 1 FROM payments p
  WHERE p.order_id = orders.order_id
    AND p.card_provider = 'stripe'
    AND p.status IN ('pending', 'processing', 'failed', 'cancelled')
)`;
