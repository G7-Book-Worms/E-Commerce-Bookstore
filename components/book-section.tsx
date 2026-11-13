import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BookCard, type Book } from "@/components/book-card";

// One catalog row, like the B&N collections page: heading + See All on top,
// then a row of books that scrolls sideways (swipe on phones, scrollbar/trackpad on laptops).
// eager = only pass this to the top section so its first covers load right away
export function BookSection({ title, books, href, total, eager = false }: {
    title: string; books: Book[]; href: string; total?: number; eager?: boolean;
}) {
    if (books.length === 0) return null; // Rows with no books are hidden

    return (
    <section aria-labelledby={`row-${href}`} className="min-w-0">
        <div className="mb-4 flex items-end justify-between gap-4 border-b pb-2">
            <h2 id={`row-${href}`} className="font-serif text-2xl font-bold">{title}</h2>
            <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline">
                See All{total ? ` (${total})` : ""} <ChevronRight size={16} />
            </Link>
        </div>
        {/* Fixed-width tiles in one line; extra books scroll instead of wrapping */}
        <ul className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3">
            {books.map((book, i) => (
                <li key={book.bookId} className="relative w-40 shrink-0 snap-start sm:w-44">
                    {/* Only the first few covers of the top row load right away */}
                    <BookCard book={book} eager={eager && i < 6} />
                </li>
            ))}
        </ul>
    </section>
    );
}
