import { BookCard } from "@/components/book-card";
import { BookSection } from "@/components/book-section";
import { sampleBooks } from "@/lib/sample-books";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

// Each section pulls its books from tags[]. Swap sampleBooks for a DB query later using Drizzle
const bestsellers = sampleBooks.filter((b) => b.tags?.includes("bestseller"));
const newReleases = sampleBooks.filter((b) => b.tags?.includes("new-release"));
const fiction = sampleBooks.filter((b) => b.tags?.includes("fiction"));
const nonFiction = sampleBooks.filter((b) => b.tags?.includes("nonfiction"));

// Main catalog page (/product-catalog). Intro text, then a few book sections, then a link to every book
export default function ProductCatalog() {
    return (
        <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 flex flex-col gap-8">
            <h1 className="text-center text-4xl ">
                Product Catalog</h1>
            <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-1xl font-bold">Find something worth staying up for.</h2>
                <p className="mt-1">
                    New releases, all-time bestsellers, and up-and-coming voices share the shelf here,
                    alongside staff picks that change every month. Fiction, nonfiction, and everything
                    in between, ready when you are.
                </p>
            <hr className="mt-12"></hr>
            </div>
            {/* Bestsellers is the first thing people see, so it's the only one w/ eager */}
            <BookSection title="Bestsellers" books={bestsellers} eager />
            <BookSection title="New Releases" books={newReleases}/>
            <BookSection title="Fiction" books={fiction}/>
            <BookSection title="Non Fiction" books={nonFiction}/>
            {/* Goes to the full list w/ filters and sorting */}
            <Link href={`product-catalog/all`} className="flex justify-center">
            <Button className="w-1/2 shadow-sm hover:shadow-md hover:bg-primary hover:scale-102" title="For our picky readers..">
                <b>See All</b>
            </Button>
            </Link>
        </main>
    );
}
