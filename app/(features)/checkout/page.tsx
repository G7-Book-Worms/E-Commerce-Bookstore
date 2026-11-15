"use client";

// Checkout (SCRUM-184): review the order, pick a shipping address, then pay on Stripe's page.
// Totals come from the server (same numbers as the cart); the browser never sends prices.
//
// SCRUM-208: someone who isn't signed in checks out as a guest instead. Their cart lives in this
// browser's localStorage, so it is sent as book ids, formats and quantities to
// POST /api/checkout/guest/quote, which answers with the same priced cart shape the signed-in
// cart uses. They type an email and an address here and never create an account.

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AddressAutocomplete, fillAddress } from "@/components/address-autocomplete";
import { recipientLine } from "@/lib/address-rules";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Lock, LogIn, Minus, Plus, ShoppingBag, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderSummary } from "@/components/cart/order-summary";
import { FormatBadge } from "@/components/format-badge";
import { formatPrice } from "@/lib/catalog";
import { loadDiscountCode, type CartData } from "@/lib/cart-types";
import { fetchUserAddresses, createUserAddress, type AddressItem } from "@/lib/api/user";
import { DeleteAddressDialog } from "@/components/delete-address-dialog";
import { useAuth } from "@/app/context/auth-context";
import { useCart, type GuestCartLine } from "@/app/context/CartContext";

const EMPTY = { recipientName: "", phone: "", street: "", city: "", state: "", zip: "", country: "United States" };
// Everything but the phone number has to be filled in
const REQUIRED: (keyof typeof EMPTY)[] = ["recipientName", "street", "city", "state", "zip", "country"];

// Both bring the shopper back to checkout afterwards; the guest cart is merged into the account.
const SIGN_IN_HREF = "/user-login?callbackUrl=%2Fcheckout";
const REGISTER_HREF = "/user-register?callbackUrl=%2Fcheckout";

// "Continue as guest" is remembered for this browser tab's session, so a reload doesn't ask again.
const GUEST_CHOICE_KEY = "bw:checkout:guest";
function loadGuestChoice(): boolean {
  try {
    return sessionStorage.getItem(GUEST_CHOICE_KEY) === "1";
  } catch {
    return false; // storage blocked (private mode): just ask again
  }
}
function saveGuestChoice() {
  try {
    sessionStorage.setItem(GUEST_CHOICE_KEY, "1");
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded
  }
}
const SKELETON = (
  <div className="mx-auto max-w-6xl p-8">
    <div className="h-96 animate-pulse rounded-xl bg-stone-200" />
  </div>
);

export default function CheckoutPage() {
  return (
    <Suspense fallback={SKELETON}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const cancelled = useSearchParams().get("cancelled") === "1";
  const { user, isLoading: authLoading } = useAuth();
  const { guestItems, setGuestQuantity, removeGuestItem } = useCart();

  const [cart, setCart] = useState<CartData | null>(null);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  // The saved address waiting on the "Delete this address?" dialog
  const [deleting, setDeleting] = useState<AddressItem | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const code = typeof window === "undefined" ? "" : loadDiscountCode();

  const isGuestCheckout = !authLoading && !user;
  // A new address for a signed-in shopper starts with their own name and phone filled in
  const prefilled = useCallback(
    () => ({ ...EMPTY, recipientName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "", phone: user?.phone ?? "" }),
    [user]
  );
  // Signed-out shoppers first choose: sign in, create an account, or continue as a guest.
  // (The server render never shows this part: it waits for the auth check, so reading
  // sessionStorage in the initializer can't cause a hydration mismatch.)
  const [guestChosen, setGuestChosen] = useState(() => typeof window !== "undefined" && loadGuestChoice());
  const emailRef = useRef<HTMLInputElement>(null);
  const focusEmail = useRef(false);
  const choosingHow = isGuestCheckout && !guestChosen;

  // After "Continue as guest", move focus to the first field of the form that just appeared.
  useEffect(() => {
    if (guestChosen && focusEmail.current) {
      focusEmail.current = false;
      emailRef.current?.focus();
    }
  }, [guestChosen]);

  function continueAsGuest() {
    saveGuestChoice();
    focusEmail.current = true;
    setGuestChosen(true);
  }

  // --- load the cart (and, for a signed-in shopper, their saved addresses) ---
  const loadSignedIn = useCallback(async () => {
    const url = code ? `/api/cart?code=${encodeURIComponent(code)}` : "/api/cart";
    const [cartJson, list] = await Promise.all([
      fetch(url, { credentials: "include", cache: "no-store" }).then((r) => r.json()),
      fetchUserAddresses().catch(() => [] as AddressItem[]),
    ]);
    setCart(cartJson.data);
    setAddresses(list);
    const preferred = list.find((a) => a.isDefault) ?? list[0];
    setAddressId(preferred?.addressId ?? null);
    setAdding(list.length === 0);
    setForm(prefilled());
  }, [code, prefilled]);

  // The guest cart holds only book ids, formats and quantities; the server prices it.
  // An empty cart needs no request: the render below shows the "cart is empty" message.
  const loadGuest = useCallback(async (items: GuestCartLine[]) => {
    if (items.length === 0) return;
    const res = await fetch("/api/checkout/guest/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, discountCode: code || undefined }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || "Could not price your cart");
    setCart(json.data);
  }, [code]);

  useEffect(() => {
    if (authLoading) return;
    const run = user ? loadSignedIn() : loadGuest(guestItems);
    run
      .then(() => setError(null))
      .catch((err) => setError((err as Error).message || "Could not load your cart. Refresh to try again."))
      .finally(() => setLoading(false));
    // guestItems is a new array whenever a quantity changes, which re-prices the cart.
  }, [authLoading, user, guestItems, loadSignedIn, loadGuest]);

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await createUserAddress({ ...form, isDefault: addresses.length === 0 });
      setAddresses([...addresses, created]);
      setAddressId(created.addressId);
      setAdding(false);
      setForm(prefilled());
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // After a saved address is deleted: drop it, and if it was the chosen one fall back to the
  // default (or the first left). With none left, open the new-address form.
  function addressDeleted(id: number) {
    const rest = addresses.filter((a) => a.addressId !== id);
    setAddresses(rest);
    setDeleting(null);
    const next = addressId === id ? (rest.find((a) => a.isDefault) ?? rest[0])?.addressId ?? null : addressId;
    setAddressId(next);
    if (rest.length === 0) setAdding(true);
    // The delete button went with the address, so put focus on the chosen address (or the form).
    requestAnimationFrame(() => {
      const target = next != null
        ? document.querySelector<HTMLInputElement>(`input[name="address"][value="${next}"]`)
        : document.querySelector<HTMLInputElement>("#checkout-address-form input");
      target?.focus();
    });
  }

  async function pay() {
    setError(null);
    if (!isGuestCheckout && !addressId) return setError("Choose a shipping address");
    setPaying(true);
    try {
      const res = isGuestCheckout
        ? await fetch("/api/checkout/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
              address: form,
              // Only ids, formats and quantities: the server re-prices everything.
              items: guestItems,
              discountCode: cart?.discount?.code,
              note: note.trim() || undefined,
            }),
          })
        : await fetch("/api/checkout", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              shippingAddressId: addressId,
              discountCode: cart?.discount?.code,
              note: note.trim() || undefined,
            }),
          });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not start checkout");
      window.location.href = json.data.url; // Stripe's hosted payment page
    } catch (err) {
      setError((err as Error).message);
      setPaying(false);
    }
  }

  if (authLoading || loading) return SKELETON;

  // A guest whose browser cart is empty, or anyone whose priced cart came back with no lines
  if (isGuestCheckout && guestItems.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty.</p>
        <Link href="/product-catalog" className="mt-4 inline-block underline">Browse books</Link>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-medium">Your cart is empty.</p>
        <Link href="/product-catalog" className="mt-4 inline-block underline">Browse books</Link>
      </div>
    );
  }

  const field = (name: keyof typeof EMPTY, label: string, auto: string, optional = false) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}{optional && <span className="font-normal text-muted-foreground"> (optional)</span>}</span>
      <input
        required={!optional}
        type={name === "phone" ? "tel" : "text"}
        autoComplete={auto}
        maxLength={name === "zip" || name === "phone" ? 20 : 100}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        className="h-9 rounded-md border px-3"
      />
    </label>
  );

  // Street with address suggestions: picking one fills in the address fields it knows.
  const streetField = () => (
    <AddressAutocomplete
      label="Street"
      required
      value={form.street}
      onChange={(street) => setForm((f) => ({ ...f, street }))}
      onSelect={(a) => setForm((f) => fillAddress(f, a))}
    />
  );

  // A guest can only pay once there is an email and every address field is filled in.
  const guestReady =
    email.trim().length > 3 &&
    email.includes("@") &&
    REQUIRED.every((k) => form[k].trim() !== "");
  const canPay = choosingHow ? false : isGuestCheckout ? guestReady : !!addressId && !adding;

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

      {isGuestCheckout && !choosingHow && (
        <p className="mb-6 rounded-md border bg-white p-3 text-sm">
          You&apos;re checking out as a guest — no account needed. Already have one?{" "}
          <Link href={SIGN_IN_HREF} className="font-medium underline">Sign in</Link>{" "}
          or <Link href={REGISTER_HREF} className="font-medium underline">create one</Link>{" "}
          and the books in your cart come with you.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {choosingHow ? (
            <CheckoutChoice onGuest={continueAsGuest} />
          ) : (
          <>
          {/* Guests: email first, since it's the only way they get their confirmation */}
          {isGuestCheckout && (
            <section className="rounded-xl border bg-white p-5">
              <h2 className="mb-4 font-serif text-xl font-bold">1. Your email</h2>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Email address</span>
                <input
                  ref={emailRef}
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={100}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="reader@example.com"
                  className="h-9 rounded-md border px-3"
                />
              </label>
              <p className="mt-2 text-xs text-muted-foreground">
                We send your order confirmation here with a private link to this one order. We don&apos;t
                create an account and you can make one afterwards if you want to.
              </p>
            </section>
          )}

          {/* Shipping address */}
          <section className="rounded-xl border bg-white p-5">
            <h2 className="mb-4 font-serif text-xl font-bold">
              {isGuestCheckout ? "2." : "1."} Shipping address
            </h2>
            {isGuestCheckout ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {field("recipientName", "Full name", "name")}
                {field("phone", "Phone", "tel", true)}
                <div className="sm:col-span-2">{streetField()}</div>
                {field("city", "City", "address-level2")}
                {field("state", "State", "address-level1")}
                {field("zip", "ZIP code", "postal-code")}
                {field("country", "Country", "country-name")}
              </div>
            ) : (
              <>
                {addresses.length > 0 && (
                  <div className="flex flex-col gap-2" role="group" aria-label="Saved shipping addresses">
                    {addresses.map((a) => (
                      <div key={a.addressId} className={`flex items-start gap-2 rounded-lg border text-sm ${addressId === a.addressId ? "border-stone-900 bg-stone-50" : ""}`}>
                        <label className="flex min-w-0 flex-1 cursor-pointer gap-3 p-3">
                          <input type="radio" name="address" value={a.addressId} checked={addressId === a.addressId} onChange={() => setAddressId(a.addressId)} />
                          <span>
                            {recipientLine(a) && <span className="font-medium">{recipientLine(a)}<br /></span>}
                            {a.street}<br />{a.city}, {a.state} {a.zip}, {a.country}
                            {a.isDefault && <span className="ml-2 text-xs text-muted-foreground">(default)</span>}
                          </span>
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="m-1.5 shrink-0 text-stone-500 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Delete address ${a.street}, ${a.city}`}
                          title="Delete this address"
                          onClick={() => setDeleting(a)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {adding ? (
                  <form id="checkout-address-form" onSubmit={saveAddress} className="mt-4 grid gap-3 sm:grid-cols-2">
                    {field("recipientName", "Full name", "name")}
                    {field("phone", "Phone", "tel", true)}
                    <div className="sm:col-span-2">{streetField()}</div>
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
                <DeleteAddressDialog address={deleting} onCancel={() => setDeleting(null)} onDeleted={addressDeleted} />
              </>
            )}
          </section>
          </>
          )}

          {/* Review items */}
          <section className="rounded-xl border bg-white p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-serif text-xl font-bold">{choosingHow ? "Your items" : `${isGuestCheckout ? "3." : "2."} Review items`}</h2>
              {!isGuestCheckout && <Link href="/cart" className="text-sm underline">Edit cart</Link>}
            </div>
            <ul className="divide-y text-sm">
              {cart.items.map((l) => (
                <li key={l.cartItemId} className="flex justify-between gap-4 py-2">
                  <span>
                    <span className="font-medium">{l.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <FormatBadge format={l.format} />
                      <span>Qty {l.quantity}</span>
                      {l.onSale && <span className="font-semibold text-red-700">Sale price</span>}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {/* Guests edit quantities here: their cart isn't on the server yet */}
                    {isGuestCheckout && (
                      <span className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Fewer copies of ${l.title}`}
                          disabled={l.quantity <= 1}
                          onClick={() => setGuestQuantity(l.bookId, l.format, l.quantity - 1)}
                        >
                          <Minus />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`More copies of ${l.title}`}
                          disabled={l.quantity >= Math.min(99, l.stock)}
                          onClick={() => setGuestQuantity(l.bookId, l.format, l.quantity + 1)}
                        >
                          <Plus />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${l.title}`}
                          onClick={() => removeGuestItem(l.bookId, l.format)}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    )}
                    <span>{formatPrice(l.lineTotalCents)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <label className="mt-4 flex flex-col gap-1 text-sm">
              <span className="font-medium">Order note (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className="rounded-md border p-2" />
            </label>
          </section>
        </div>

        {/* Pay */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary cart={cart}>
            <Button className="mt-5 w-full" size="lg" onClick={pay} disabled={paying || !canPay}>
              <Lock /> {paying ? "Opening secure payment…" : `Pay ${formatPrice(cart.totals.totalCents)}`}
            </Button>
            {choosingHow && (
              <p className="mt-2 text-xs text-muted-foreground">Choose how you&apos;d like to check out to continue.</p>
            )}
            {isGuestCheckout && !choosingHow && !guestReady && (
              <p className="mt-2 text-xs text-muted-foreground">Add your email and shipping address to continue.</p>
            )}
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

// First step for a shopper who isn't signed in. Real links for the account routes and a real
// button for the guest option, which reveals the guest form in place.
function CheckoutChoice({ onGuest }: { onGuest: () => void }) {
  const option =
    "group flex w-full items-center gap-4 rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-stone-900 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2";
  const icon =
    "flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700 group-hover:bg-stone-900 group-hover:text-white";
  return (
    <section aria-labelledby="checkout-choice-title" className="rounded-xl border bg-white p-5">
      <h2 id="checkout-choice-title" className="font-serif text-xl font-bold">How would you like to check out?</h2>
      <p className="mt-1 text-sm text-muted-foreground">The books in your cart come with you whichever you pick.</p>
      <ul className="mt-4 flex flex-col gap-3">
        <li>
          <Link href={SIGN_IN_HREF} className={option}>
            <span className={icon}><LogIn className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Sign in</span>
              <span className="block text-sm text-muted-foreground">Use your saved addresses and keep the order in your history.</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-stone-400" aria-hidden />
          </Link>
        </li>
        <li>
          <Link href={REGISTER_HREF} className={option}>
            <span className={icon}><UserPlus className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Create an account</span>
              <span className="block text-sm text-muted-foreground">Takes a minute. Track your orders and check out faster next time.</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-stone-400" aria-hidden />
          </Link>
        </li>
        <li>
          <button type="button" onClick={onGuest} className={option}>
            <span className={icon}><ShoppingBag className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Continue as guest</span>
              <span className="block text-sm text-muted-foreground">No account needed. We email your confirmation and a link to the order.</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-stone-400" aria-hidden />
          </button>
        </li>
      </ul>
    </section>
  );
}
