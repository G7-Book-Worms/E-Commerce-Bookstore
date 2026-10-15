import { BookBrowser } from "./book-browser";
import { sampleBooks } from "@/lib/sample-books";

// Every book in one place (/product-catalog/all).
// This page stays a server component so it can fetch from the DB later.
// The filters live in book-browser.tsx since they need to run in the browser
export default function ProductCatalogAll() {
    return (
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 flex flex-col gap-8">
            <h1 className="text-center text-4xl ">
                Product Catalog - All</h1>
            <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-1xl font-bold">An ambitious reader, are we?</h2>
                <p className="mt-1">
                    You&apos;ve searched far and wide, but <i>still</i> can&apos;t
                    find anything that tickles your fancy? Well, here it is.
                    Everything we&apos;ve got. Window shop or buy it all. Find your
                    next best thing. Your conversation starter at parties. The book that
                    changes your life. We&apos;re here for it, and we&apos;ll ship it
                    for free. Never stop reading. Never stop dreaming.
                </p>
            </div>
            <hr></hr>
            {/* Swap sampleBooks for a DB query later using Drizzle */}
            <BookBrowser books={sampleBooks} />
        </main>
    );
}
