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
import { useCart } from "@/app/context/CartContext";
import { formatPrice, stockLabel } from "@/lib/catalog";
import { loadDiscountCode, saveDiscountCode, type CartData, type CartLine } from "@/lib/cart-types";

const LABEL = { hardcover: "Hardcover", paperback: "Paperback" } as const;

export default function CartPage() {
  const { applyServerCart } = useCart();
  const [cart, setCart] = useState<CartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [code, setCode] = useState("");
  const [codeInput, setCodeInput] = useState("");

  // Every /api/cart response returns the full updated cart in `data`
  const callCart = useCallback(async (appliedCode: string, init?: RequestInit) => {
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
  }, [applyServerCart]);

  useEffect(() => {
    // The code saved earlier in this tab (sessionStorage only exists in the browser)
    const saved = loadDiscountCode();
    callCart(saved)
      .then(() => {
        setCode(saved);
        setCodeInput(saved);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [callCart]);

  const mutate = async (line: CartLine, init: RequestInit) => {
    setBusyLine(line.cartItemId);
    setError(null);
    try {
      await callCart(code, init);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyLine(null);
    }
  };

  const changeQuantity = (line: CartLine, amount: number) => {
    const quantity = line.quantity + amount;
    if (quantity < 1 || quantity > line.stock) return;
    mutate(line, { method: "PATCH", body: JSON.stringify({ bookId: line.bookId, format: line.format, quantity }) });
  };

  const removeLine = (line: CartLine) =>
    mutate(line, { method: "DELETE", body: JSON.stringify({ bookId: line.bookId, format: line.format }) });

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
            <Link href={`/user-login?callbackUrl=${encodeURIComponent("/cart")}`} className={buttonVariants()}>Sign in</Link>
            <Link href="/user-register" className={buttonVariants({ variant: "outline" })}>Create an account</Link>
          </div>
        </EmptyState>
      ) : lines.length === 0 ? (
        <EmptyState image="cart" title="Your cart is empty">
          <p>This pup is waiting for you to find a good book.</p>
          <Link href="/product-catalog" className={`${buttonVariants()} mt-5`}>Browse books</Link>
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
                        <p className="text-sm text-muted-foreground">{line.author} · {LABEL[line.format]}</p>
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
                      {line.quantity > line.stock ? `Only ${line.stock} left. Lower the quantity to check out.` : stockLabel(line.stock)}
                    </p>
                    <div className="mt-auto flex items-center gap-3 pt-2">
                      <div className="flex items-center rounded-md border">
                        <Button variant="ghost" size="icon-sm" onClick={() => changeQuantity(line, -1)} disabled={busy || line.quantity <= 1} aria-label={`Fewer copies of ${line.title}`}>
                          <Minus />
                        </Button>
                        <span className="w-8 text-center tabular-nums">{line.quantity}</span>
                        <Button variant="ghost" size="icon-sm" onClick={() => changeQuantity(line, 1)} disabled={busy || line.quantity >= line.stock} aria-label={`More copies of ${line.title}`}>
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
                  placeholder="e.g. BOOKWORMS10"
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
                  <Button className="mt-5 w-full" size="lg" disabled>Checkout</Button>
                ) : (
                  <Link href="/checkout" className={buttonVariants({ size: "lg", className: "mt-5 w-full" })}>
                    Checkout
                  </Link>
                )}
                <Link href="/product-catalog" className="mt-3 block text-center text-sm underline">Continue shopping</Link>
              </OrderSummary>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
