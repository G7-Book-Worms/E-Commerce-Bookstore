"use client";

// Checkout success (SCRUM-186): confirm the payment with the server (which asks Stripe),
// then show the order confirmation.

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/app/context/CartContext";
import { formatPrice } from "@/lib/catalog";
import { saveDiscountCode } from "@/lib/cart-types";

type Summary = {
  order: { orderId: number; subtotalCents: number; discountCents: number; taxCents: number; priceCents: number; created: string };
  email?: string;
  address: { street: string; city: string; state: string; zip: string } | null;
  payment: { status: string; cardBrand: string | null; cardLast4: string | null } | null;
  items: { orderItemId: number; title: string; format: string; quantity: number; unitPrice: string }[];
};

export default function SuccessPage() {
  return (
    <Suspense fallback={<p className="p-16 text-center">Confirming your payment…</p>}>
      <Success />
    </Suspense>
  );
}

function Success() {
  const sessionId = useSearchParams().get("session_id");
  const { refreshCart } = useCart();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false); // React dev mode runs effects twice

  useEffect(() => {
    if (!sessionId || started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/checkout/complete", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "We couldn't confirm your payment");
        saveDiscountCode("");
        refreshCart();
        const order = await fetch(`/api/orders/${json.data.orderId}`, { credentials: "include" }).then((r) => r.json());
        setSummary(order.data);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, [sessionId, refreshCart]);

  if (!sessionId) return <p className="p-16 text-center">Missing checkout session. <Link href="/cart" className="underline">Back to cart</Link></p>;
  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-red-700">{error}</p>
        <Link href="/cart" className="mt-4 inline-block underline">Back to cart</Link>
      </div>
    );
  }
  if (!summary) return <p className="p-16 text-center text-muted-foreground">Confirming your payment…</p>;

  const { order } = summary;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
        <h1 className="mt-3 font-serif text-3xl font-bold">Thank you for your order!</h1>
        <p className="mt-2 text-muted-foreground">
          Order #{order.orderId}{summary.email ? ` · confirmation for ${summary.email}` : ""}
        </p>
      </div>

      <div className="mt-8 rounded-xl border bg-white p-5 text-sm">
        <ul className="divide-y">
          {summary.items.map((i) => (
            <li key={i.orderItemId} className="flex justify-between gap-4 py-2">
              <span>{i.title} <span className="text-muted-foreground">({i.format}) × {i.quantity}</span></span>
              <span>{formatPrice(Math.round(Number(i.unitPrice) * 100) * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t pt-4">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotalCents)}</dd></div>
          {order.discountCents > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>−{formatPrice(order.discountCents)}</dd></div>}
          <div className="flex justify-between"><dt>Tax (8.25%)</dt><dd>{formatPrice(order.taxCents)}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>Total paid</dt><dd>{formatPrice(order.priceCents)}</dd></div>
        </dl>
        <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
          {summary.address && (
            <div><p className="font-semibold">Shipping to</p><p>{summary.address.street}<br />{summary.address.city}, {summary.address.state} {summary.address.zip}</p></div>
          )}
          {summary.payment?.cardLast4 && (
            <div>
              <p className="font-semibold">Payment</p>
              <p><span className="capitalize">{summary.payment.cardBrand}</span> ending {summary.payment.cardLast4}</p>
              {summary.payment.status === "refunded" && <p className="text-xs text-muted-foreground">Test charge refunded automatically</p>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/account?tab=orders" className={buttonVariants({ variant: "outline" })}>View order history</Link>
        <Link href="/product-catalog" className={buttonVariants()}>Keep shopping</Link>
      </div>
    </div>
  );
}
