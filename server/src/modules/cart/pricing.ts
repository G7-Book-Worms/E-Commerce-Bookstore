// Order math, in whole cents. Used by the cart, checkout and the order record,
// so the number the shopper sees is the number Stripe charges and the number we store.
// Pure functions (no database) so they can be unit tested (pricing.test.ts).

export const TAX_RATE = 0.0825; // Course requirement: assume 8.25% sales tax

export type PricedLine = {
  quantity: number;
  regularPriceCents: number; // list price of the chosen format
  salePriceCents: number | null; // sale price when that format is on sale
};

export type DiscountRule = {
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
};

export type OrderTotals = {
  subtotalCents: number; // after sale prices, before the discount code
  saleSavingsCents: number; // how much sale prices already saved
  discountCents: number; // taken off by the discount code
  taxCents: number; // 8.25% of (subtotal - discount)
  totalCents: number;
};

export const unitPrice = (l: PricedLine) => l.salePriceCents ?? l.regularPriceCents;

// Money rounding: half a cent rounds up (banker's rounding is not what receipts use)
const roundCents = (n: number) => Math.floor(n + 0.5);

export function discountFor(subtotalCents: number, rule: DiscountRule | null): number {
  if (!rule || subtotalCents <= 0) return 0;
  const raw = rule.percentOff !== null
    ? roundCents((subtotalCents * rule.percentOff) / 100)
    : rule.amountOffCents ?? 0;
  return Math.max(0, Math.min(raw, subtotalCents)); // never below $0
}

export function priceOrder(lines: PricedLine[], rule: DiscountRule | null): OrderTotals {
  const subtotalCents = lines.reduce((n, l) => n + unitPrice(l) * l.quantity, 0);
  const regularCents = lines.reduce((n, l) => n + l.regularPriceCents * l.quantity, 0);
  const discountCents = discountFor(subtotalCents, rule);
  const taxCents = roundCents((subtotalCents - discountCents) * TAX_RATE);
  return {
    subtotalCents,
    saleSavingsCents: regularCents - subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
  };
}

export function describeDiscount(rule: DiscountRule) {
  return rule.percentOff !== null
    ? `${rule.percentOff}% off`
    : `$${((rule.amountOffCents ?? 0) / 100).toFixed(2)} off`;
}
