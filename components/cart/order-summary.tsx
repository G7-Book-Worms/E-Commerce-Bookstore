import { formatPrice } from "@/lib/catalog";
import type { CartData } from "@/lib/cart-types";

// Subtotal, sale savings, discount, 8.25% tax and total. Same numbers the server charges.
export function OrderSummary({ cart, children }: { cart: CartData; children?: React.ReactNode }) {
  const t = cart.totals;
  return (
    <div className="rounded-xl border bg-white p-5 shadow-xs">
      <h2 className="mb-4 font-serif text-xl font-bold">Order summary</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal ({cart.totalCount} item{cart.totalCount === 1 ? "" : "s"})</dt>
          <dd>{formatPrice(t.subtotalCents)}</dd>
        </div>
        {t.saleSavingsCents > 0 && (
          <div className="flex justify-between text-red-700">
            <dt>Sale savings (included above)</dt>
            <dd>−{formatPrice(t.saleSavingsCents)}</dd>
          </div>
        )}
        {cart.discount && (
          <div className="flex justify-between text-emerald-700">
            <dt>Discount: {cart.discount.code} ({cart.discount.label})</dt>
            <dd>−{formatPrice(t.discountCents)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Shipping</dt>
          <dd>Free</dd>
        </div>
        <div className="flex justify-between">
          <dt>Tax (8.25%)</dt>
          <dd>{formatPrice(t.taxCents)}</dd>
        </div>
        <div className="flex justify-between border-t pt-3 text-base font-bold">
          <dt>Total</dt>
          <dd>{formatPrice(t.totalCents)}</dd>
        </div>
      </dl>
      {children}
    </div>
  );
}
