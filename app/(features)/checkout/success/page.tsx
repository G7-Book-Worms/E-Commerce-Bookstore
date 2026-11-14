"use client";

// Checkout success (SCRUM-186): confirm the payment with the server (which asks Stripe),
// then show the order confirmation.
//
// SCRUM-208: a guest comes back with ?guest=1 and is confirmed through the guest endpoints. They
// have no order history, so the page shows the private link to this one order and offers to turn
// the email they just used into an account.

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCart } from "@/app/context/CartContext";
import { useAuth } from "@/app/context/auth-context";
import { formatPrice } from "@/lib/catalog";
import { saveDiscountCode } from "@/lib/cart-types";
import { registerUser } from "@/lib/api/auth";

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
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const isGuestOrder = params.get("guest") === "1";
  const { refreshCart, clearGuestCart } = useCart();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [guestEmail, setGuestEmail] = useState<string | null>(null);
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false); // React dev mode runs effects twice

  useEffect(() => {
    if (!sessionId || started.current) return;
    started.current = true;
    (async () => {
      try {
        if (isGuestOrder) {
          const res = await fetch("/api/checkout/guest/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok) throw new Error(json?.error || "We couldn't confirm your payment");
          saveDiscountCode("");
          clearGuestCart();
          setGuestEmail(json.data.email ?? null);
          setViewToken(json.data.viewToken ?? null);

          // The guest order view only returns what's safe to show behind a forwardable link,
          // so the shipping street and email are not part of it.
          const order = await fetch("/api/checkout/guest/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: json.data.viewToken }),
          }).then((r) => r.json());
          const d = order.data;
          setSummary({ ...d, address: null, email: json.data.email ?? undefined });
          return;
        }

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
  }, [sessionId, isGuestOrder, refreshCart, clearGuestCart]);

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

      {isGuestOrder ? (
        <>
          {viewToken && (
            <p className="mt-6 rounded-xl border bg-stone-50 p-4 text-sm">
              You checked out as a guest, so there&apos;s no order history to look in. We emailed you a
              private link to this order{guestEmail ? ` at ${guestEmail}` : ""}, and you can{" "}
              <Link href={`/checkout/guest-order?token=${encodeURIComponent(viewToken)}`} className="font-medium underline">
                open it here
              </Link>
              . The link works for this one order and expires in 30 days — please don&apos;t forward it.
            </p>
          )}
          <CreateAccountOffer email={guestEmail} />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/product-catalog" className={buttonVariants()}>Keep shopping</Link>
          </div>
        </>
      ) : (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account?tab=orders" className={buttonVariants({ variant: "outline" })}>View order history</Link>
          <Link href="/product-catalog" className={buttonVariants()}>Keep shopping</Link>
        </div>
      )}
    </div>
  );
}

/**
 * SCRUM-208: offer the guest an account on the email they just used. It posts to the normal
 * registration endpoint, which applies the same password policy as the sign-up page; the email is
 * pre-filled and fixed so the account matches the order they just placed.
 */
function CreateAccountOffer({ email }: { email: string | null }) {
  const { refreshSession } = useAuth();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!email) return null;

  if (done) {
    return (
      <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Your account is ready. Future orders will show up in{" "}
        <Link href="/account?tab=orders" className="font-medium underline">your order history</Link>.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return; // the form is only rendered when we know the address
    setBusy(true);
    setError(null);
    try {
      await registerUser({ firstName: firstName.trim(), lastName: lastName.trim(), email, password });
      await refreshSession();
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Could not create your account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border bg-white p-5">
      <h2 className="font-serif text-lg font-bold">Want an account for next time?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ll set one up for <strong>{email}</strong> so your next orders are saved and checkout is
        one click. Your cart and this order stay exactly as they are.
      </p>
      {!open ? (
        <Button className="mt-4" variant="outline" onClick={() => setOpen(true)}>
          Create an account with {email}
        </Button>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">First name</span>
            <input required maxLength={50} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9 rounded-md border px-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Last name</span>
            <input required maxLength={50} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9 rounded-md border px-3" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Email</span>
            <input readOnly value={email} className="h-9 rounded-md border bg-stone-100 px-3 text-muted-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-medium">Choose a password</span>
            <input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-9 rounded-md border px-3" />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Not now</Button>
          </div>
        </form>
      )}
    </div>
  );
}
