"use client";

// Checkout (SCRUM-184): review the order, pick a shipping address, then pay on Stripe's page.
// Totals come from the server (same numbers as the cart); the browser never sends prices.

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderSummary } from "@/components/cart/order-summary";
import { formatPrice } from "@/lib/catalog";
import { loadDiscountCode, type CartData } from "@/lib/cart-types";
import { fetchUserAddresses, createUserAddress, type AddressItem } from "@/lib/api/user";

const EMPTY = { street: "", city: "", state: "", zip: "", country: "United States" };

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-8"><div className="h-96 animate-pulse rounded-xl bg-stone-200" /></div>}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const cancelled = useSearchParams().get("cancelled") === "1";
  const [cart, setCart] = useState<CartData | null>(null);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const code = typeof window === "undefined" ? "" : loadDiscountCode();

  useEffect(() => {
    const url = code ? `/api/cart?code=${encodeURIComponent(code)}` : "/api/cart";
    Promise.all([
      fetch(url, { credentials: "include", cache: "no-store" }).then((r) => r.json()),
      fetchUserAddresses().catch(() => [] as AddressItem[]),
    ])
      .then(([cartJson, list]) => {
        setCart(cartJson.data);
        setAddresses(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        setAddressId(preferred?.addressId ?? null);
        setAdding(list.length === 0);
      })
      .catch(() => setError("Could not load your cart. Refresh to try again."))
      .finally(() => setLoading(false));
  }, [code]);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await createUserAddress({ ...form, isDefault: addresses.length === 0 });
      setAddresses([...addresses, created]);
      setAddressId(created.addressId);
      setAdding(false);
      setForm(EMPTY);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function pay() {
    if (!addressId) return setError("Choose a shipping address");
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddressId: addressId, discountCode: cart?.discount?.code, note: note.trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not start checkout");
      window.location.href = json.data.url; // Stripe's hosted payment page
    } catch (err) {
      setError((err as Error).message);
      setPaying(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl p-8"><div className="h-96 animate-pulse rounded-xl bg-stone-200" /></div>;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty.</p>
        <Link href="/product-catalog" className="mt-4 inline-block underline">Browse books</Link>
      </div>
    );
  }

  const field = (name: keyof typeof EMPTY, label: string, auto: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        required
        autoComplete={auto}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        className="h-9 rounded-md border px-3"
      />
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <nav className="mb-2 text-sm text-stone-500"><Link href="/cart" className="hover:underline">Cart</Link> / Checkout</nav>
      <h1 className="mb-6 font-serif text-3xl font-bold">Checkout</h1>

      {cancelled && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Payment was cancelled. Nothing was charged; your cart is still here.
        </p>
      )}
      {error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {/* 1. Shipping address */}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-serif text-xl font-bold">1. Shipping address</h2>
            {addresses.length > 0 && (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Shipping address">
                {addresses.map((a) => (
                  <label key={a.addressId} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${addressId === a.addressId ? "border-stone-900 bg-stone-50" : ""}`}>
                    <input type="radio" name="address" checked={addressId === a.addressId} onChange={() => setAddressId(a.addressId)} />
                    <span>
                      {a.street}<br />{a.city}, {a.state} {a.zip}, {a.country}
                      {a.isDefault && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {adding ? (
              <form onSubmit={saveAddress} className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">{field("street", "Street", "street-address")}</div>
                {field("city", "City", "address-level2")}
                {field("state", "State", "address-level1")}
                {field("zip", "ZIP code", "postal-code")}
                {field("country", "Country", "country-name")}
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit">Save address</Button>
                  {addresses.length > 0 && <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>}
                </div>
              </form>
            ) : (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setAdding(true)}>Add a new address</Button>
            )}
          </section>

          {/* 2. Review items */}
          <section className="rounded-xl border bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-xl font-bold">2. Review items</h2>
              <Link href="/cart" className="text-sm underline">Edit cart</Link>
            </div>
            <ul className="divide-y text-sm">
              {cart.items.map((l) => (
                <li key={l.cartItemId} className="flex justify-between gap-4 py-2">
                  <span>
                    <span className="font-medium">{l.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {l.format === "hardcover" ? "Hardcover" : "Paperback"} · Qty {l.quantity}
                      {l.onSale && <span className="ml-1 font-semibold text-red-700">· Sale price</span>}
                    </span>
                  </span>
                  <span>{formatPrice(l.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-medium">Order note (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="rounded-md border p-2" />
            </label>
          </section>
        </div>

        {/* 3. Pay */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary cart={cart}>
            <Button className="mt-5 w-full" size="lg" onClick={pay} disabled={paying || !addressId || adding}>
              <Lock /> {paying ? "Opening secure payment…" : `Pay ${formatPrice(cart.totals.totalCents)}`}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              You&apos;ll pay on Stripe&apos;s secure page. This store runs in <b>test mode</b>: use card
              4242 4242 4242 4242, any future date and any CVC. Test charges are refunded automatically.
            </p>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}
