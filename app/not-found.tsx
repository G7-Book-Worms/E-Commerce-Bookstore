// Shown for any URL that doesn't exist (and when a page calls notFound(), e.g. an unknown ISBN).
//
// Why this file renders its own <html> and <body>: the app has no single root layout. Each route
// group ((main), (features), (auth), (staff)) has its own root layout with its own <html>, so
// there is no layout above app/not-found.tsx to wrap it. It therefore brings the same shell as the
// storefront itself: globals.css, the auth and cart providers, the class-project strip, the real
// Header (with the site's search) and Footer. The page then looks like any other shop page, and
// search lives in the header where it always is.
//
// The picture is one of the site's cute-animal photos. Those photos have pure-white backgrounds,
// so this page's middle section is white too (not the shop's off-white): no box around the photo
// and no strip of contrast between the photo and the page.
import './globals.css';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthProvider } from './context/auth-context';
import { CartProvider } from './context/CartContext';
import { Header } from '../components/header/Header';
import { Footer } from '../components/footer/Footer';
import { DemoStrip } from '../components/demo-notice';

export const metadata = { title: 'Page not found | Book Worms', robots: { index: false, follow: false } };

const SHELVES = [
  { href: '/product-catalog/all?section=bestseller', label: 'Bestsellers' },
  { href: '/product-catalog/all?section=new-release', label: 'New releases' },
  { href: '/product-catalog/all?onSale=true', label: 'On sale' },
];

export default function NotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-stone-50 text-stone-900 antialiased">
        <AuthProvider>
          <CartProvider>
            <DemoStrip />
            <Suspense fallback={<div className="h-16 border-b border-stone-200 bg-white" />}>
              <Header />
            </Suspense>
            <main className="flex flex-1 items-center justify-center bg-white px-4 py-10 sm:py-16">
              <div className="flex w-full max-w-lg flex-col items-center text-center">
                <Image
                  src="/images/empty-states/french-bulldog-puppy-frowning.webp"
                  alt=""
                  width={1200}
                  height={900}
                  priority
                  className="h-auto w-full max-w-[15rem] sm:max-w-[19rem]"
                />

                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Error 404 · Page not found</p>
                <h1 className="mt-2 text-balance font-serif text-3xl font-bold leading-tight sm:text-4xl">
                  This page has wandered off the shelf
                </h1>
                <p className="mt-3 text-pretty text-sm text-stone-600 sm:text-base">
                  The link may be old, or the book may no longer be in our catalog. Search above, or try one of these:
                </p>

                <div className="mt-7 grid w-full gap-3 sm:w-auto sm:grid-cols-2">
                  <Link
                    href="/"
                    className="inline-flex h-11 items-center justify-center rounded-md bg-stone-900 px-6 text-sm font-medium text-stone-50 hover:bg-stone-800"
                  >
                    Back to the home page
                  </Link>
                  <Link
                    href="/product-catalog"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 bg-white px-6 text-sm font-medium hover:bg-stone-100"
                  >
                    Browse all books
                  </Link>
                </div>

                <nav aria-label="Popular shelves" className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {SHELVES.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="inline-flex h-9 items-center rounded-full border border-stone-200 bg-white px-4 text-sm text-stone-700 hover:border-stone-400 hover:text-stone-900"
                    >
                      {s.label}
                    </Link>
                  ))}
                </nav>
              </div>
            </main>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
