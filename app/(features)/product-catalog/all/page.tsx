import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ZodError } from "zod";
import { BookBrowser } from "./book-browser";
import { SECTIONS } from "@/lib/catalog";
import { parseCatalogQuery, searchBooks, type CatalogQuery } from "@/server/src/modules/books/catalog-repository";

export const metadata = { title: "All Books | Book Worms" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Heading for the current list: the section, the genre, the search, or everything
function titleFor(q: CatalogQuery) {
  if (q.q) return `Results for "${q.q}"`;
  const match = SECTIONS.find(
    (s) => (q.section && s.param === `section=${q.section}`) || (q.genre && s.param === `genre=${q.genre}`)
  );
  if (match) return match.label;
  if (q.genre) return q.genre.charAt(0).toUpperCase() + q.genre.slice(1);
  if (q.onSale) return "On Sale";
  return "All Books";
}

// Every book in one place (/product-catalog/all), or one section of the catalog (See All links)
// or search results (header search bar). The URL holds every filter, so links can be shared and Back works.
// Filtering and sorting run in the database (GET /api/books uses the same searchBooks function)
export default function ProductCatalogAll({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8 md:px-8"><div className="h-96 animate-pulse rounded-lg bg-stone-200" /></div>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;

  let query: CatalogQuery;
  try {
    query = parseCatalogQuery({ pageSize: "24", ...params });
  } catch (e) {
    // Hand-edited URL with a bad value: show a friendly message instead of an error page
    const message = e instanceof ZodError ? e.issues[0]?.message : "Invalid filters";
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg">{message}</p>
        <Link href="/product-catalog/all" className="mt-4 inline-block underline">Clear filters</Link>
      </div>
    );
  }

  const result = await searchBooks(query);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 flex flex-col gap-6">
      <nav className="text-sm text-stone-500">
        <Link href="/product-catalog" className="hover:underline">Books</Link> / <span>{titleFor(query)}</span>
      </nav>
      <h1 className="font-serif text-3xl font-bold">{titleFor(query)}</h1>
      <BookBrowser
        books={result.books}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        query={query}
      />
    </div>
  );
}
