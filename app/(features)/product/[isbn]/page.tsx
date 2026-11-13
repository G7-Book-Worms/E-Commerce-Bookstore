import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductView } from "./product-view";
import { BookSection } from "@/components/book-section";
import { findCatalogBookByIsbn, parseCatalogQuery, searchBooks } from "@/server/src/modules/books/catalog-repository";

type Params = Promise<{ isbn: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  await connection();
  const book = await findCatalogBookByIsbn(decodeURIComponent((await params).isbn));
  return { title: book ? `${book.title} by ${book.author} | Book Worms` : "Book not found | Book Worms" };
}

// /product/[isbn]: the book from the database (SCRUM-181), plus more books in the same genre
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

  const genre = book.category?.slug;
  const related = genre
    ? (await searchBooks(parseCatalogQuery({ genre, sort: "rating-desc", pageSize: "13" }))).books.filter((b) => b.bookId !== book.bookId).slice(0, 12)
    : [];

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
      {book.category && (
        <BookSection title={`More in ${book.category.name}`} books={related} href={`/product-catalog/all?genre=${book.category.slug}`} />
      )}
    </>
  );
}
