"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// One line of GET /api/cart -> data.items
type CartBook = {
  bookId: number;
  title: string;
  author: string;
  isbn: string;
  priceCents: number;
  coverImageUrl: string | null;
  quantity: number;
  stock: number; // the server rejects quantities above this
};

type CartData = {
  items: CartBook[];
  totalCount: number;
  subtotalCents: number;
};

const money = (cents: number) => "$" + (cents / 100).toFixed(2); // small helper function to format pricing

export default function CartPage() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyBookId, setBusyBookId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Every /api/cart response returns the full updated cart in `data`
  const callCart = useCallback(async (init?: RequestInit) => {
    const res = await fetch("/api/cart", {
      credentials: "include",
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const json = await res.json().catch(() => null);
    if (res.status === 401) {
      window.location.href = `/user-login?callbackUrl=${encodeURIComponent("/cart")}`;
      return;
    }
    if (!res.ok) {
      throw new Error(json?.error || json?.message || "Something went wrong with your cart");
    }
    setCart(json.data);
  }, []);

  useEffect(() => {
    callCart()
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [callCart]);

  const mutate = async (bookId: number, init: RequestInit) => {
    setBusyBookId(bookId);
    setError(null);
    try {
      await callCart(init);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyBookId(null);
    }
  };

  const changeQuantity = (book: CartBook, amount: number) => {
    const quantity = book.quantity + amount;
    if (quantity < 1 || quantity > book.stock) return;
    mutate(book.bookId, { method: "PATCH", body: JSON.stringify({ bookId: book.bookId, quantity }) });
  };

  const removeBook = (bookId: number) => {
    mutate(bookId, { method: "DELETE", body: JSON.stringify({ bookId }) });
  };

  const books = cart?.items ?? [];
  const total = cart?.subtotalCents ?? 0;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-lg border-2 border-foreground p-8 sm:p-10">
        <h1 className="mb-8 text-center text-3xl font-bold">Shopping cart</h1>

        {error && (
          <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="divide-y">
          {isLoading && (
            <p className="py-10 text-center text-muted-foreground">Loading your cart...</p>
          )}

          {!isLoading && books.length === 0 && (
            <p className="py-10 text-center text-muted-foreground">
              Your cart is empty.
            </p>
          )}

          {books.map((CartBook) => (
            <div
              key={CartBook.bookId}
              className="flex items-center justify-between gap-6 py-5"
            >

              <div className="flex min-w-0 items-center gap-4">
                {CartBook.coverImageUrl ? (
                  <img
                    src={CartBook.coverImageUrl}
                    alt={`Cover of ${CartBook.title}`}
                    className="h-24 w-16 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-muted text-2xl"
                  >
                    📖
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <p className="font-medium leading-tight">{CartBook.title}</p>
                  <p className="text-sm text-muted-foreground">{CartBook.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {money(CartBook.priceCents)}
                  </p>
                </div>
              </div>


              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeQuantity(CartBook, -1)}
                    disabled={busyBookId !== null || CartBook.quantity <= 1}
                    aria-label={`Decrease ${CartBook.title}`}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center">{CartBook.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeQuantity(CartBook, 1)}
                    disabled={busyBookId !== null || CartBook.quantity >= CartBook.stock}
                    aria-label={`Increase ${CartBook.title}`}
                  >
                    +
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBook(CartBook.bookId)}
                  disabled={busyBookId !== null}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>


        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <p className="text-lg font-semibold">Total: {money(total)}</p>
          <Button disabled={books.length === 0}>Checkout</Button>
        </div>
      </div>
    </main>
  );
}
