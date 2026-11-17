"use client";

// Guest order lookup (SCRUM-208): /checkout/guest-order and /checkout/guest-order?token=...
//
// A guest shows they placed the order with two things: the order number (or the link from their
// confirmation email, which carries it) AND the email address they ordered with. The server
// checks both and answers every miss the same way, so neither a forwarded link nor a guessed
// order number reveals anything.
//
// The token and email are sent in the body of a POST (not as a query string to our own API) so
// they don't end up in server access logs, and the layout sets referrer: no-referrer so the token
// in this page's URL doesn't leak to anywhere it links.

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Package, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormatBadge } from "@/components/format-badge";
import { formatPrice } from "@/lib/catalog";

type Status = "pending" | "transit" | "arrived" | "cancelled";
type GuestOrder = {
  order: {
    orderId: number;
    status: Status;
    created: string;
    shipment: { carrierLabel: string | null; trackingNumber: string; trackingUrl: string | null } | null;
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    priceCents: number;
  };
  email: string | null;
  payment: { status: string; cardBrand: string | null; cardLast4: string | null } | null;
  shipTo: { recipientName: string | null; phone: string | null; street: string; city: string; state: string; zip: string; country: string } | null;
  /** False when looked up by order number: street and phone are only shown via the emailed link */
  fullAddress: boolean;
  items: { orderItemId: number; title: string; author: string; format: string; quantity: number; unitPrice: string }[];
};

const STATUS_TEXT: Record<Status, string> = {
  pending: "Being prepared",
  transit: "On its way (pretend shipping: this is a class project)",
  arrived: "Marked as delivered",
  cancelled: "Cancelled",
};

export default function GuestOrderPage() {
  return (
    <Suspense fallback={<p className="p-16 text-center text-muted-foreground">Loading…</p>}>
      <GuestOrderLookup />
    </Suspense>
  );
}

function GuestOrderLookup() {
  const token = useSearchParams().get("token");
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [data, setData] = useState<GuestOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => first.current?.focus(), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token && !/^\d+$/.test(orderId.replace(/^#/, "").trim())) return setError("Enter your order number (it's in your confirmation email).");
    if (!email.includes("@")) return setError("Enter the email address you ordered with.");
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/guest/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { token, email: email.trim() } : { orderId: orderId.replace(/^#/, "").trim(), email: email.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "We couldn't find that order.");
      setData(json.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (data) return <OrderView data={data} />;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <div className="text-center">
        <Search className="mx-auto size-9 text-stone-700" aria-hidden />
        <h1 className="mt-3 font-serif text-3xl font-bold">Find Your Order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {token
            ? "To keep your order private, confirm the email address you ordered with."
            : "For orders placed as a guest. Enter the order number from your confirmation email and the email address you used."}
        </p>
      </div>

      <form onSubmit={submit} noValidate className="mt-8 space-y-4 rounded-xl border bg-white p-5">
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!token && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Order number</span>
            <input
              ref={first}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 1042"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="h-10 rounded-md border px-3"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email address</span>
          <input
            ref={token ? first : undefined}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-md border px-3"
          />
        </label>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Looking it up…" : "Show My Order"}</Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Have an account? <Link href="/user-login?callbackUrl=%2Faccount%3Ftab%3Dorders" className="underline">Sign In</Link> to see all your orders.
      </p>
    </div>
  );
}

function OrderView({ data }: { data: GuestOrder }) {
  const { order, shipTo } = data;
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="text-center">
        <Package className="mx-auto size-10 text-stone-700" aria-hidden />
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
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {i.author && <span>by {i.author}</span>}
                  <FormatBadge format={i.format} />
                  <span>× {i.quantity}</span>
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
          {shipTo && (
            <div>
              <p className="font-semibold">Shipping to</p>
              <address className="not-italic">
                {shipTo.recipientName && <>{shipTo.recipientName}<br /></>}
                {shipTo.street && <>{shipTo.street}<br /></>}{shipTo.city}, {shipTo.state} {shipTo.zip}<br />{shipTo.country}
                {shipTo.phone && <><br />{shipTo.phone}</>}
              </address>
              {!data.fullAddress && (
                <p className="mt-1 text-xs text-muted-foreground">The full address is in your confirmation email and behind its link.</p>
              )}
            </div>
          )}
          <div className="space-y-3">
            {data.payment?.cardLast4 && (
              <div>
                <p className="font-semibold">Payment</p>
                <p><span className="capitalize">{data.payment.cardBrand}</span> ending {data.payment.cardLast4}</p>
                {data.payment.status === "refunded" && <p className="text-xs text-muted-foreground">Test charge refunded automatically</p>}
              </div>
            )}
            {order.shipment && (
              <div>
                <p className="font-semibold">Tracking</p>
                <p>{order.shipment.carrierLabel ? `${order.shipment.carrierLabel} ` : ""}{order.shipment.trackingNumber}</p>
                {order.shipment.trackingUrl && (
                  <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                    Track on {order.shipment.carrierLabel ?? "the carrier's site"} <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Link href="/product-catalog" className={buttonVariants({ variant: "outline" })}>Browse Books</Link>
        <Link href={`/user-register?callbackUrl=${encodeURIComponent("/account?tab=orders")}`} className={buttonVariants({ variant: "ghost" })}>Create an account</Link>
      </div>
    </div>
  );
}
