import Image from 'next/image'
import Link from 'next/link'
import { Button } from "@/components/ui/button";

// Shape of a book. Will be replaced by the Drizzle schema type once the DB is set up
export type Book = {
    title: string;
    author: string;
    price: number; // In dollars for now. Should be stored as cents in the DB
    tags: string[] | null // Used for sections and filters. Full list is at the top of lib/sample-books.ts
    img_src : string
    img_alt : string // Read out by screen readers in place of the cover
    isbn13: string // Stored as text since we never do math on it. Also used as the product page URL
    ;
};

// One book tile. Cover, title, author, price and an Add to Cart button
// eager = load the cover right away instead of waiting for the user to scroll near it
export function BookCard({ book, eager = false }: { book: Book; eager?: boolean }) {
    return (
    <div className="rounded-lg border p-3 hover:shadow-md transition-shadow duration-300">
        {/* Whole card links to the product page.
            Add to Cart sits outside the link since a button inside a link is invalid HTML */}
        <Link href={`/product/${book.isbn13}`}>
        {/* Box is locked to a 2:3 book shape so every card lines up even before the cover loads */}
        <div className="relative aspect-2/3 bg-muted">
            <Image
                loading={eager ? "eager" : "lazy"} // Book covers further down don't download until you scroll near them
                src={book.img_src}
                alt={book.img_alt}
                sizes="(min-width: 1024px) 180px, (min-width: 768px) 25vw, 50vw" // Lets Next.js pick a smaller file on smaller screens
                fill className="object-cover" // Fills the box above instead of needing a set width and height
            />
        </div>
        <div>
            {/* Titles cut off at 2 lines w/ "..." and always take up 2 lines so the authors line up across a row
                Hovering shows the full title in tooltip */}
            <h2 className="mt-3 line-clamp-2 min-h-[2lh]" title={book.title}>{book.title}</h2>
            <p className="text-gray-500" title={book.author}>{book.author}</p>
            <p>${book.price.toFixed(2)}</p>
        </div>
        </Link>
        {/* TODO: call an addToCart server action once the cart is set up */}
        <Button className="w-full mt-3 shadow-sm hover:shadow-md hover:bg-primary hover:scale-102" title="Add to Cart">
            Add to Cart
        </Button>
    </div>
    );
}