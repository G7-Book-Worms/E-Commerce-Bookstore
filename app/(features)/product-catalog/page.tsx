import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { BookSection } from "@/components/book-section";
import { buttonVariants } from "@/components/ui/button";
import { catalogRows } from "@/server/src/modules/books/catalog-repository";

export const metadata = { title: 'Books | Book Worms' };

// Main catalog page (/product-catalog). Intro text, then one row per section (from the database),
// each w/ a See All link, then a link to every book
export default function ProductCatalog() {
    return (
        <div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-8 md:px-8 flex flex-col gap-10">
            <div className="text-center max-w-2xl mx-auto">
                <h1 className="font-serif text-4xl font-bold">Books</h1>
                <h2 className="mt-3 font-bold">Find something worth staying up for.</h2>
                <p className="mt-1 text-stone-600">
                    New releases, all-time bestsellers, and up-and-coming voices share the shelf here,
                    alongside staff picks that change every month. Fiction, nonfiction, and everything
                    in between, ready when you are.
                </p>
            </div>
            {/* The rows come from the database, so they stream in after the intro */}
            <Suspense fallback={<RowsSkeleton />}>
                <CatalogRows />
            </Suspense>
            {/* Goes to the full list w/ filters and sorting */}
            <Link
                href="/product-catalog/all"
                className={buttonVariants({ size: "lg", className: "mx-auto w-full sm:w-1/2 font-bold shadow-sm hover:shadow-md" })}
                title="For our picky readers.."
            >
                Browse All Books
            </Link>
        </div>
    );
}

async function CatalogRows() {
    await connection(); // Render at request time so the build doesn't need the database
    const rows = await catalogRows(12);
    return (
        <>
            {/* Bestsellers is the first thing people see, so it's the only one w/ eager */}
            {rows.map((row, i) => (
                <BookSection
                    key={row.key}
                    title={row.label}
                    books={row.books}
                    total={row.total}
                    href={`/product-catalog/all?${row.param}`}
                    eager={i === 0}
                />
            ))}
        </>
    );
}

function RowsSkeleton() {
    return (
        <div className="flex flex-col gap-10 animate-pulse">
            {[0, 1].map((r) => (
                <div key={r} className="flex flex-col gap-4">
                    <div className="h-7 w-48 rounded bg-stone-200" />
                    <div className="flex gap-4 overflow-hidden">
                        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-80 w-44 shrink-0 rounded-lg bg-stone-200" />)}
                    </div>
                </div>
            ))}
        </div>
    );
}
