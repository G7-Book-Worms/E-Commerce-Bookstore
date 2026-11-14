"use client";

// Guest order view (SCRUM-208): /checkout/guest-order?token=...
//
// The link from a guest's confirmation email. The token is the only thing that opens it, and the
// server reads the order id out of the token, so this page can never be pointed at someone
// else's order by editing a number in the URL.
//
// The token is sent in the body of a POST (not as a query string to our own API) so it does not
// end up in server access logs, and the layout sets referrer: no-referrer so it does not leak to
// anywhere this page links.

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Package } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/catalog";

type GuestOrder = {
  order: {
    orderId: number;
    status: "pending" | "transit" | "arrived" | "cancelled";
    created: string;
    trackingNumber: string | null;
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    priceCents: number;
  };
  payment: { status: string; cardBrand: string | null; cardLast4: string | null } | null;
  shipTo: { city: string; state: string; zip: string; country: string } | null;
  items: { orderItemId: number; title: string; author: string; format: string; quantity: number; unitPrice: string }[];
};

const STATUS_TEXT: Record<GuestOrder["order"]["status"], string> = {
  pending: "Being prepared",
  transit: "On its way (pretend shipping: this is a class project)",
  arrived: "Marked as delivered",
  cancelled: "Cancelled",
};

export default function GuestOrderPage() {
  return (
    <Suspense fallback={<p className="p-16 text-center text-muted-foreground">Opening your order…</p>}>
      <GuestOrderView />
    </Suspense>
  );
}

function GuestOrderView() {
  const token = useSearchParams().get("token");
  const [data, setData] = useState<GuestOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return; // handled in the render below
    fetch("/api/checkout/guest/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "This order link is invalid or has expired");
        setData(json.data);
      })
      .catch((err) => setError((err as Error).message));
  }, [token]);

  const message = token
    ? error
    : "This order link is incomplete. Please open the link from your confirmation email again.";

  if (message) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-red-700">{message}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Order links expire 30 days after the order. If you need this order after that, reply to your
          confirmation email and a staff member can look it up.
        </p>
        <Link href="/product-catalog" className="mt-6 inline-block underline">Browse books</Link>
      </div>
    );
  }
  if (!data) return <p className="p-16 text-center text-muted-foreground">Opening your order…</p>;

  const { order } = data;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="text-center">
        <Package className="mx-auto size-10 text-stone-700" />
        <h1 className="mt-3 font-serif text-3xl font-bold">Order #{order.orderId}</h1>
        <p className="mt-2 text-muted-foreground">
          {STATUS_TEXT[order.status]} · placed {new Date(order.created).toLocaleDateString()}
        </p>
      </div>

      <div className="mt-8 rounded-xl border bg-white p-5 text-sm">
        <ul className="divide-y">
          {data.items.map((i) => (
            <li key={i.orderItemId} className="flex justify-between gap-4 py-2">
              <span>
                <span className="font-medium">{i.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.author ? `by ${i.author} · ` : ""}{i.format} × {i.quantity}
                </span>
              </span>
              <span>{formatPrice(Math.round(Number(i.unitPrice) * 100) * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t pt-4">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotalCents)}</dd></div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>−{formatPrice(order.discountCents)}</dd></div>
          )}
          <div className="flex justify-between"><dt>Tax (8.25%)</dt><dd>{formatPrice(order.taxCents)}</dd></div>
          <div className="flex justify-between text-base font-bold"><dt>Total paid</dt><dd>{formatPrice(order.priceCents)}</dd></div>
        </dl>
        <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
          {data.shipTo && (
            <div>
              <p className="font-semibold">Shipping to</p>
              <p>{data.shipTo.city}, {data.shipTo.state} {data.shipTo.zip}</p>
              <p className="text-xs text-muted-foreground">
                The full address is on your confirmation email, not on this page.
              </p>
            </div>
          )}
          {data.payment?.cardLast4 && (
            <div>
              <p className="font-semibold">Payment</p>
              <p><span className="capitalize">{data.payment.cardBrand}</span> ending {data.payment.cardLast4}</p>
              {data.payment.status === "refunded" && (
                <p className="text-xs text-muted-foreground">Test charge refunded automatically</p>
              )}
            </div>
          )}
          {order.trackingNumber && (
            <div>
              <p className="font-semibold">Tracking</p>
              <p>{order.trackingNumber} <span className="text-xs text-muted-foreground">(not a real shipment)</span></p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Anyone with this link can see this order, so please don&apos;t share it. It expires 30 days after
        the order was placed.
      </p>
      <div className="mt-6 flex justify-center">
        <Link href="/product-catalog" className={buttonVariants({ variant: "outline" })}>Browse books</Link>
      </div>
    </div>
  );
}
