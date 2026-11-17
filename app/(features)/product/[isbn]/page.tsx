import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductView } from "./product-view";
import { BookSection } from "@/components/book-section";
import { findCatalogBookByIsbn } from "@/server/src/modules/books/catalog-repository";
import { youMayLike } from "@/server/src/modules/books/recommendations";

type Params = Promise<{ isbn: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  await connection();
  const book = await findCatalogBookByIsbn(decodeURIComponent((await params).isbn));
  return { title: book ? `${book.title} by ${book.author} | Book Worms` : "Book not found | Book Worms" };
}

// /product/[isbn]: the book from the database (SCRUM-181), plus "You may like": books by the same
// author, in the same genre, sharing tags, or bought in the same orders (recommendations.ts)
export default function ProductPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-4 py-8 md:px-8 flex flex-col gap-12">
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-xl bg-stone-200" />}>
        <Product params={params} />
      </Suspense>
    </div>
  );
}

async function Product({ params }: { params: Params }) {
  await connection();
  const isbn = decodeURIComponent((await params).isbn);
  const book = await findCatalogBookByIsbn(isbn);
  if (!book) notFound();

  const suggestions = await youMayLike(book);
  const captions = Object.fromEntries(suggestions.map((s) => [s.book.bookId, s.reason]));

  return (
    <>
      <nav className="text-sm text-stone-500">
        <Link href="/product-catalog" className="hover:underline">Books</Link>
        {book.category && (
          <> / <Link href={`/product-catalog/all?genre=${book.category.slug}`} className="hover:underline">{book.category.name}</Link></>
        )}
        {" / "}<span className="text-stone-700">{book.title}</span>
      </nav>
      <ProductView book={book} />
      <BookSection
        title="You may like"
        books={suggestions.map((s) => s.book)}
        captions={captions}
        href={book.category ? `/product-catalog/all?genre=${book.category.slug}` : "/product-catalog/all"}
      />
    </>
  );
}
