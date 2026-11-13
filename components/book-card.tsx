'use client';

import Link from 'next/link'
import { showToast } from "@/components/toast";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { formatPrice, stockLabel, type CatalogBook } from "@/lib/catalog";
import { useCart } from "@/app/context/CartContext";
import { useAuth } from "@/app/context/auth-context";

// Kept as the name other files import. Same shape as a book from GET /api/books
export type Book = CatalogBook;

// One book tile. Cover, title, author, rating, price (sale marked), quantity and an Add to Cart button
// eager = load the cover right away instead of waiting for the user to scroll near it
export function BookCard({ book, eager = false }: { book: Book; eager?: boolean }) {
    const router = useRouter();
    const { user } = useAuth();
    const { toggleCartItem, isInCart } = useCart();
    const [busy, setBusy] = useState(false);
    const inCart = isInCart(book.bookId);
    const soldOut = book.totalStock <= 0;

    async function addToCart() {
        // Guests sign in first, then come back to the catalog
        if (!user) {
            router.push(`/user-login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return;
        }
        setBusy(true);
        const wasInCart = inCart;
        await toggleCartItem(book.bookId);
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
        <Button
            className="w-full mt-3 shadow-sm hover:shadow-md hover:scale-102"
            variant={inCart ? "outline" : "default"}
            disabled={soldOut || busy}
            onClick={addToCart}
            title={soldOut ? "Out of stock" : inCart ? "Remove from cart" : "Add to cart"}
        >
            {soldOut ? "Out of Stock" : inCart ? "In Cart ✓" : "Add to Cart"}
        </Button>
    </div>
    );
}
