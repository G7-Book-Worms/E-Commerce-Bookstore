"use client";

// Shopping cart (Notion Cart epic + course checklist): items with format and quantity,
// sale prices marked, discount code, 8.25% tax and an order summary, then checkout.
// Started from Adam's cart page.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { BookCover } from "@/components/book-cover";
import { OrderSummary } from "@/components/cart/order-summary";
import { EmptyState } from "@/components/empty-state";
import { FormatBadge } from "@/components/format-badge";
import { useCart } from "@/app/context/CartContext";
import { useAuth } from "@/app/context/auth-context";
import { formatPrice, stockLabel } from "@/lib/catalog";
import { loadDiscountCode, saveDiscountCode, type CartData, type CartLine } from "@/lib/cart-types";
import { QuantityInput } from "@/components/cart/quantity-input";
import { showToast } from "@/components/toast";
import { MAX_PER_LINE, limitMessage } from "@/lib/quantity";

export default function CartPage() {
  // SCRUM-208: a guest's cart lives in this browser, so it is priced by the guest quote endpoint
  // and edited through the cart context instead of /api/cart.
  const { applyServerCart, isGuest, guestItems, setGuestQuantity, removeGuestItem } = useCart();
  const { isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [code, setCode] = useState("");
  const [codeInput, setCodeInput] = useState("");

  // Every /api/cart response returns the full updated cart in `data`
  const callCart = useCallback(async (appliedCode: string, init?: RequestInit) => {
    // Guests: send the ids, formats and quantities this browser is holding and let the server
    // price them. Quantity changes and removals never reach here (see changeQuantity/removeLine).
    if (isGuest) {
      setSignedOut(false);
      if (guestItems.length === 0) {
        setCart(null);
        return;
      }
      const res = await fetch("/api/checkout/guest/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: guestItems, discountCode: appliedCode || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Could not price your cart");
      setCart(json.data);
      return;
    }

    const url = appliedCode ? `/api/cart?code=${encodeURIComponent(appliedCode)}` : "/api/cart";
    const res = await fetch(init ? "/api/cart" : url, {
      credentials: "include",
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      // Signed out: show the "sign in to see your cart" message instead of jumping to the login page
      setSignedOut(true);
      return;
    }
    if (!res.ok) throw new Error(json?.error || "Something went wrong with your cart");
    applyServerCart(json.data);
    // Changes don't carry the code, so re-price with it afterwards
    if (init && appliedCode) {
      const again = await fetch(url, { credentials: "include", cache: "no-store" }).then((r) => r.json());
      setCart(again.data);
    } else {
      setCart(json.data);
    }
    // guestItems changes identity on every guest edit, which re-prices the cart below.
  }, [applyServerCart, isGuest, guestItems]);

  useEffect(() => {
    // Wait until we know whether anyone is signed in, so a guest never sees a flash of
    // "sign in to see your cart" from a 401 on /api/cart.
    if (authLoading) return;
    // The code saved earlier in this tab (sessionStorage only exists in the browser)
    const saved = loadDiscountCode();
    callCart(saved)
      .then(() => {
        setCode(saved);
        setCodeInput(saved);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [callCart, authLoading]);

  /** Sends one cart change; false when it failed (the error banner says why). */
  const mutate = async (line: CartLine, init: RequestInit): Promise<boolean> => {
    setBusyLine(line.cartItemId);
    setError(null);
    try {
      await callCart(code, init);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusyLine(null);
    }
  };

  const edition = (line: CartLine) => (line.format === "hardcover" ? "Hardcover" : "Paperback");
  const lineKey = (line: CartLine) => `qty:${line.bookId}:${line.format}`;

  /** Sets a line to an exact quantity (typed in, or + / −). 0 removes it. */
  const setQuantity = async (line: CartLine, quantity: number): Promise<boolean> => {
    if (quantity <= 0) return (await removeLine(line)) !== false;
    const max = Math.min(MAX_PER_LINE, line.stock);
    if (quantity > max) {
      // Going down but still above what's left (stock fell since it was added): go to the most allowed
      if (quantity < line.quantity && max > 0) quantity = max;
      else {
        // Shown as a toast that shakes harder each time instead of stacking up
        showToast(max > 0 ? limitMessage(max, edition(line)) : "This edition is out of stock. Remove it to check out.", { tone: "warn", key: lineKey(line) });
        return false;
      }
    }
    // A guest's cart is local, so this is a state change, not a request.
    if (isGuest) {
      setGuestQuantity(line.bookId, line.format, quantity);
      return true;
    }
    return mutate(line, { method: "PATCH", body: JSON.stringify({ bookId: line.bookId, format: line.format, quantity }) });
  };

  const changeQuantity = (line: CartLine, amount: number) => {
    const quantity = line.quantity + amount;
    if (quantity < 1) {
      showToast("1 copy is the minimum. Use Remove to take it out of your cart.", { tone: "warn", key: lineKey(line) });
      return;
    }
    void setQuantity(line, quantity);
  };

  const removeLine = (line: CartLine) => {
    if (isGuest) return removeGuestItem(line.bookId, line.format);
    return mutate(line, { method: "DELETE", body: JSON.stringify({ bookId: line.bookId, format: line.format }) });
  };

  async function applyCode(e: React.FormEvent) {
    e.preventDefault();
    const next = codeInput.trim().toUpperCase();
    setCode(next);
    setCodeInput(next);
    try {
      await callCart(next);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Only remember codes that worked, so checkout never starts with a bad one
  useEffect(() => {
    if (!cart) return;
    saveDiscountCode(cart.discount?.code ?? "");
  }, [cart]);

  async function removeCode() {
    setCode("");
    setCodeInput("");
    await callCart("");
  }

  const lines = cart?.items ?? [];
  const blocked = lines.some((l) => l.quantity > l.stock);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <h1 className="mb-6 font-serif text-3xl font-bold">Shopping Cart</h1>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-stone-200" />
      ) : signedOut ? (
        <EmptyState image="signIn" title="Sign in to see your cart">
          <p>Your cart is saved to your account, so it follows you to any device.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href={`/user-login?callbackUrl=${encodeURIComponent("/cart")}`} className={buttonVariants()}>Sign In</Link>
            <Link href={`/user-register?callbackUrl=${encodeURIComponent("/cart")}`} className={buttonVariants({ variant: "outline" })}>Create an account</Link>
          </div>
        </EmptyState>
      ) : lines.length === 0 ? (
        <EmptyState image="cart" title="Your cart is empty">
          <p>This pup is waiting for you to find a good book.</p>
          <Link href="/product-catalog" className={`${buttonVariants()} mt-5`}>Browse Books</Link>
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <ul className="divide-y rounded-xl border bg-white">
            {lines.map((line) => {
              const busy = busyLine === line.cartItemId;
              return (
                <li key={line.cartItemId} className="flex gap-4 p-4 sm:p-5">
                  <Link href={`/product/${encodeURIComponent(line.isbn)}`} className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded border sm:w-24">
                    <BookCover title={line.title} author={line.author} isbn={line.isbn} coverImageUrl={line.coverImageUrl} sizes="96px" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link href={`/product/${encodeURIComponent(line.isbn)}`} className="font-medium leading-tight hover:underline">{line.title}</Link>
                        <p className="text-sm text-muted-foreground">{line.author}</p>
                        <FormatBadge format={line.format} className="mt-1.5" />
                      </div>
                      <p className="font-semibold">{formatPrice(line.lineTotalCents)}</p>
                    </div>
                    {/* Course checklist: indicate when the price is a sale price */}
                    <p className="text-sm">
                      {line.onSale ? (
                        <>
                          <span className="mr-2 rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Sale</span>
                          <span className="font-medium text-red-700">{formatPrice(line.unitPriceCents)}</span>{" "}
                          <span className="text-muted-foreground line-through">{formatPrice(line.regularPriceCents)}</span>
                        </>
                      ) : (
                        <span>{formatPrice(line.unitPriceCents)}</span>
                      )}
                      <span className="text-muted-foreground"> each</span>
                    </p>
                    <p className={`text-xs ${line.quantity > line.stock ? "font-medium text-red-700" : "text-muted-foreground"}`}>
                      {line.quantity > line.stock
                        ? line.stock <= 0
                          ? "Out of stock now. Remove it to check out."
                          : `Only ${line.stock} left. Lower the quantity to check out.`
                        : stockLabel(line.stock)}
                    </p>
                    <div className="mt-auto flex items-center gap-3 pt-2">
                      <div className="flex items-center rounded-md border">
                        {/* At the limits the buttons stay clickable (aria-disabled) and explain why
                            nothing changed, instead of silently doing nothing */}
                        <Button variant="ghost" size="icon-sm" onClick={() => changeQuantity(line, -1)} disabled={busy} aria-disabled={line.quantity <= 1 || undefined} className="aria-disabled:opacity-40" aria-label={`Fewer copies of ${line.title}`}>
                          <Minus />
                        </Button>
                        <QuantityInput
                          quantity={line.quantity}
                          stock={line.stock}
                          edition={edition(line)}
                          title={line.title}
                          disabled={busy}
                          toastKey={lineKey(line)}
                          onCommit={(q) => setQuantity(line, q)}
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => changeQuantity(line, 1)} disabled={busy} aria-disabled={line.quantity >= Math.min(MAX_PER_LINE, line.stock) || undefined} className="aria-disabled:opacity-40" aria-label={`More copies of ${line.title}`}>
                          <Plus />
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeLine(line)} disabled={busy}>
                        <Trash2 /> Remove
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            {/* Discount code */}
            <form onSubmit={applyCode} className="rounded-xl border bg-white p-5">
              <label htmlFor="code" className="text-sm font-semibold">Discount code</label>
              <div className="mt-2 flex gap-2">
                <input
                  id="code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="BOOKWORMS10"
                  autoComplete="off"
                  className="h-9 min-w-0 flex-1 rounded-md border px-3 text-sm uppercase"
                />
                <Button type="submit" variant="outline" disabled={!codeInput.trim()}>Apply</Button>
              </div>
              {cart?.discountError && <p className="mt-2 text-xs text-red-700">{cart.discountError}</p>}
              {cart?.discount && (
                <p className="mt-2 flex items-center justify-between text-xs text-emerald-700">
                  <span>{cart.discount.code} applied: {cart.discount.label}</span>
                  <button type="button" onClick={removeCode} className="underline">Remove</button>
                </p>
              )}
            </form>

            {cart && (
              <OrderSummary cart={cart}>
                {blocked ? (
                  <>
                    <Button className="mt-5 w-full" size="lg" disabled>Checkout</Button>
                    <p role="status" className="mt-2 text-center text-xs font-medium text-red-700">
                      {lines.filter((l) => l.quantity > l.stock).length === 1
                        ? "One book in your cart has fewer copies left than you've added. Lower its quantity or remove it to check out."
                        : "Some books in your cart have fewer copies left than you've added. Lower their quantities or remove them to check out."}
                    </p>
                  </>
                ) : (
                  <Link href="/checkout" className={buttonVariants({ size: "lg", className: "mt-5 w-full" })}>
                    Checkout
                  </Link>
                )}
                {/* Signed out: checkout opens with a choice of signing in, creating an account or continuing as a guest */}
                {isGuest && !blocked && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Next, sign in, create an account or check out as a guest.
                  </p>
                )}
                <Link href="/product-catalog" className="mt-1 block py-3 text-center text-sm underline">Continue Shopping</Link>
              </OrderSummary>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
