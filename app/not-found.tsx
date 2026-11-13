// Shown for any URL that doesn't exist (and for unknown ISBNs).
// The app has one root layout per route group, so this page brings its own <html> and styles.
import './globals.css';
import Link from 'next/link';

export const metadata = { title: 'Page not found | Book Worms' };

export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-serif text-2xl font-bold">
            <span aria-hidden>📚</span> Book Worms
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/empty-states/french-bulldog-puppy-frowning.webp" alt="" loading="lazy" width={240} height={180} className="h-40 w-auto" />
          <p className="font-serif text-sm font-bold uppercase tracking-widest text-stone-400">Error 404</p>
          <h1 className="font-serif text-2xl font-bold">We couldn&apos;t find that page</h1>
          <p className="text-sm text-stone-600">The link may be old, or the book may no longer be in our catalog.</p>
          <form action="/product-catalog/all" className="flex w-full gap-2">
            <input
              name="q"
              type="search"
              aria-label="Search books"
              placeholder="Search books"
              className="h-10 min-w-0 flex-1 rounded-full border border-stone-300 bg-white px-4 text-sm"
            />
            <button className="h-10 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white">Search</button>
          </form>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="underline">Home</Link>
            <Link href="/product-catalog" className="underline">Browse books</Link>
          </div>
        </main>
      </body>
    </html>
  );
}
