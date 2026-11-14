'use client';

import Link from 'next/link'
import { showToast } from "@/components/toast";
import { useState } from 'react';
import { Minus, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { defaultCartFormat, formatPrice, stockLabel, type CatalogBook } from "@/lib/catalog";
import { useCart, type CartFormat } from "@/app/context/CartContext";

// Kept as the name other files import. Same shape as a book from GET /api/books
export type Book = CatalogBook;

/**
 * The "In cart" button once a book is in the cart: − quantity + , so the shopper can change
 * how many copies they want without leaving the catalogue.
 *
 * The − and + are faded out until the control is hovered or something inside it is focused,
 * so a page of tiles stays calm. That only applies from `md` up: on a touch screen there is
 * no hover, so below `md` they are simply always visible. They are ordinary buttons either
 * way — faded, not hidden — so Tab reaches them and a screen reader reads them at any size.
 */
export function CartStepper({
  bookId,
  format,
  quantity,
  max,
  title,
  className = "",
}: {
  bookId: number;
  format: CartFormat;
  quantity: number;
  /** Copies in stock for this format: the + stops there */
  max: number;
  /** Book title, for the button labels a screen reader reads out */
  title: string;
  className?: string;
}) {
  const { setCartQuantity } = useCart();
  const [busy, setBusy] = useState(false);
  // Show the asked-for number straight away; the server's answer replaces it a moment later
  const [pending, setPending] = useState<number | null>(null);
  const shown = pending ?? quantity;

  async function change(to: number) {
    if (busy) return;
    setBusy(true);
    setPending(to);
    const error = await setCartQuantity(bookId, format, to);
    setPending(null);
    setBusy(false);
    if (error) showToast(error);
    else if (to === 0) showToast(`Removed “${title}” from your cart`, { href: '/cart', linkText: 'View cart' });
  }

  return (
    <div
      className={`group/stepper flex w-full items-center justify-between gap-1 rounded-md border border-stone-300 bg-white px-1 ${className}`}
      // One label for the whole control, so a screen reader announces what the buttons belong to
      role="group"
      aria-label={`Copies of ${title} in your cart`}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 opacity-0 transition-opacity group-hover/stepper:opacity-100 group-focus-within/stepper:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
        disabled={busy}
        aria-label={shown <= 1 ? `Remove ${title} from your cart` : `One fewer copy of ${title}`}
        onClick={() => change(shown - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <span className="min-w-0 flex-1 truncate text-center text-sm font-medium tabular-nums" aria-live="polite">
        {shown} in cart
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 opacity-0 transition-opacity group-hover/stepper:opacity-100 group-focus-within/stepper:opacity-100 focus-visible:opacity-100 max-md:opacity-100 disabled:opacity-40"
        disabled={busy || shown >= max}
        aria-label={shown >= max ? `No more copies of ${title} in stock` : `One more copy of ${title}`}
        onClick={() => change(shown + 1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}

// One book tile. Cover, title, author, rating, price (sale marked), quantity and an Add to Cart button
// eager = load the cover right away instead of waiting for the user to scroll near it
export function BookCard({ book, eager = false }: { book: Book; eager?: boolean }) {
    const { toggleCartItem, addToCart: addLine, isGuest, isInCart, linesForBook } = useCart();
    const [busy, setBusy] = useState(false);
    const inCart = isInCart(book.bookId);
    const soldOut = book.totalStock <= 0;

    // The cart lines for this book. One line (the normal case) gets the quantity stepper;
    // a book in the cart in both editions is sent to the cart page, since one stepper can't
    // say which edition it would be changing.
    const lines = linesForBook(book.bookId);
    const line = lines.length === 1 ? lines[0] : null;
    const lineStock = line ? (book.formats.find((f) => f.format === line.format)?.stock ?? 0) : 0;

    async function addToCart() {
        setBusy(true);
        const wasInCart = inCart;
        // A guest's cart lives in this browser (SCRUM-208). Adding stores the edition the server
        // would choose - the cheapest in stock - so the line gets a quantity stepper straight away.
        // Removing, and every signed-in change, goes through the toggle as before.
        const guestFormat = isGuest && !wasInCart ? defaultCartFormat(book) : null;
        if (guestFormat) await addLine(book.bookId, guestFormat, 1);
        else await toggleCartItem(book.bookId);
        setBusy(false);
        showToast(wasInCart ? `Removed “${book.title}” from your cart` : `Added “${book.title}” to your cart`, { href: '/cart', linkText: 'View cart' });
    }

    return (
    <div className="relative flex h-full flex-col rounded-lg border bg-white p-3 hover:shadow-md transition-shadow duration-300">
        {/* Whole card links to the product page.
            Add to Cart sits outside the link since a button inside a link is invalid HTML */}
        <Link href={`/product/${encodeURIComponent(book.isbn)}`} className="flex-1">
        {/* Box is locked to a 2:3 book shape so every card lines up even before the cover loads */}
        <div className="relative aspect-2/3 overflow-hidden rounded bg-muted">
            <BookCover title={book.title} author={book.author} isbn={book.isbn} coverImageUrl={book.coverImageUrl} eager={eager} />
            {book.onSale && (
                <span className="absolute left-2 top-2 rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Sale</span>
            )}
        </div>
        <div className="mt-3 flex flex-col gap-1">
            {/* Titles cut off at 2 lines w/ "..." and always take up 2 lines so the authors line up across a row
                Hovering shows the full title in tooltip */}
            <h2 className="line-clamp-2 min-h-[2lh] font-medium leading-snug" title={book.title}>{book.title}</h2>
            <p className="text-sm text-gray-500 line-clamp-1" title={book.author}>{book.author}</p>
            <StarRating value={book.ratingAvg} count={book.ratingCount} />
            <p className="flex items-baseline gap-2">
                <span className={book.onSale && book.fromPriceCents < book.regularPriceCents ? "font-semibold text-red-700" : "font-semibold"}>
                    {formatPrice(book.fromPriceCents)}
                </span>
                {book.fromPriceCents < book.regularPriceCents && (
                    <span className="text-xs text-gray-500 line-through">{formatPrice(book.regularPriceCents)}</span>
                )}
            </p>
            {/* Course requirement: available quantity on the main sale page */}
            <p className={`text-xs ${soldOut ? "text-red-700" : book.totalStock <= 3 ? "text-amber-700" : "text-emerald-700"}`}>
                {stockLabel(book.totalStock)}
            </p>
        </div>
        </Link>
        <div className="mt-3">
        {line ? (
            <CartStepper
                bookId={book.bookId}
                format={line.format}
                quantity={line.quantity}
                max={lineStock}
                title={book.title}
            />
        ) : lines.length > 1 ? (
            <Link href="/cart" className={buttonVariants({ variant: "outline", className: "w-full shadow-sm hover:shadow-md" })}>
                In cart ({lines.reduce((n, l) => n + l.quantity, 0)}) · Edit
            </Link>
        ) : (
            <Button
                className="w-full shadow-sm hover:shadow-md hover:scale-102"
                variant={inCart ? "outline" : "default"}
                disabled={soldOut || busy}
                onClick={addToCart}
                title={soldOut ? "Out of stock" : inCart ? "Remove from cart" : "Add to cart"}
            >
                {soldOut ? "Out of Stock" : inCart ? "In Cart ✓" : "Add to Cart"}
            </Button>
        )}
        </div>
    </div>
    );
}
