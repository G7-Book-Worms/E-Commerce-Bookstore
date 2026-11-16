// Shown for any URL that doesn't exist (and when a page calls notFound(), e.g. an unknown ISBN).
//
// Why this file renders its own <html> and <body>: the app has no single root layout. Each route
// group ((main), (features), (auth), (staff)) has its own root layout with its own <html>, so
// there is no layout above app/not-found.tsx to wrap it. It therefore brings the same shell as the
// storefront itself: globals.css, the auth and cart providers, the class-project strip, the real
// Header (with the site's search) and Footer. The page then looks like any other shop page, and
// search lives in the header where it always is.
//
// The illustration is an original inline SVG (a bookworm in reading glasses peeking out of an
// open book, with the bookmark fallen out), so there is no photo with its own background.
import './globals.css';
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
            <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
              <div className="flex w-full max-w-lg flex-col items-center text-center">
                <LostBookworm className="h-auto w-full max-w-[16rem] sm:max-w-[20rem]" />

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

/** Original drawing: an open book, a bookworm in reading glasses peeking out of a hole in the
 *  right-hand page, and the bookmark ribbon that has slipped out underneath. Decorative only. */
function LostBookworm({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 210" className={className} aria-hidden focusable="false">
      {/* soft shadow under the book */}
      <ellipse cx="160" cy="178" rx="128" ry="9" fill="#e7e5e4" />

      {/* the bookmark, slipped out of the spine and lying on the table */}
      <path d="M161 160 C 158 172, 176 176, 196 178 L 232 180" fill="none" stroke="#b45309" strokeWidth="7" strokeLinecap="round" />
      <path d="M229 176.5 L 246 175 L 240 180.5 L 247 186 L 230 184 Z" fill="#b45309" />

      {/* cover */}
      <path d="M26 66 L26 162 Q93 148 160 166 Q227 148 294 162 L294 66 Q227 54 160 70 Q93 54 26 66 Z" fill="#166534" />
      {/* page edges */}
      <path d="M34 64 L34 156 Q97 143 158 159 L158 66 Q97 52 34 64 Z" fill="#e7e5e4" />
      <path d="M286 64 L286 156 Q223 143 162 159 L162 66 Q223 52 286 64 Z" fill="#e7e5e4" />
      {/* pages */}
      <path d="M38 60 L38 152 Q99 139 158 155 L158 62 Q99 48 38 60 Z" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="1.5" />
      <path d="M282 60 L282 152 Q221 139 162 155 L162 62 Q221 48 282 60 Z" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="1.5" />
      {/* spine shadow */}
      <path d="M152 62 Q157 62 160 66 Q163 62 168 62 L168 154 Q163 154 160 158 Q157 154 152 154 Z" fill="#e7e5e4" opacity="0.7" />

      {/* text on the left-hand page */}
      <g stroke="#d6d3d1" strokeWidth="3" strokeLinecap="round">
        <path d="M54 76 Q96 68 142 76" fill="none" />
        <path d="M54 89 Q96 81 142 89" fill="none" />
        <path d="M54 102 Q96 94 142 102" fill="none" />
        <path d="M54 115 Q96 107 130 113" fill="none" />
        <path d="M54 128 Q96 120 142 128" fill="none" />
        <path d="M54 141 Q90 134 116 138" fill="none" />
      </g>
      {/* a couple of lines on the right-hand page, above the hole */}
      <g stroke="#d6d3d1" strokeWidth="3" strokeLinecap="round">
        <path d="M178 76 Q222 68 266 76" fill="none" />
        <path d="M178 89 Q206 84 226 86" fill="none" />
      </g>

      {/* the hole the worm came through */}
      <ellipse cx="214" cy="128" rx="17" ry="6.5" fill="#44403c" />

      {/* the bookworm: segmented body rising out of the hole */}
      <path d="M214 128 C 210 104, 226 92, 242 98" fill="none" stroke="#16a34a" strokeWidth="17" />
      <path d="M214 128 C 210 104, 226 92, 242 98" fill="none" stroke="#15803d" strokeWidth="17" strokeDasharray="1.6 8" />
      {/* the near rim of the hole, in front of the body */}
      <path d="M197 128 A17 6.5 0 0 0 231 128 L231 133 L197 133 Z" fill="#fafaf9" />
      <path d="M197 128 A17 6.5 0 0 0 231 128" fill="none" stroke="#a8a29e" strokeWidth="1.5" />

      {/* head */}
      <circle cx="248" cy="96" r="15" fill="#22c55e" />
      <circle cx="248" cy="96" r="15" fill="none" stroke="#15803d" strokeWidth="1.5" />
      {/* antennae */}
      <path d="M243 82 Q 240 72, 235 70" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="234.5" cy="69.5" r="2.5" fill="#15803d" />
      <path d="M253 82 Q 257 72, 262 71" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="262.5" cy="70.5" r="2.5" fill="#15803d" />
      {/* reading glasses */}
      <circle cx="242.5" cy="95" r="5.5" fill="#fafaf9" stroke="#292524" strokeWidth="1.8" />
      <circle cx="255" cy="95" r="5.5" fill="#fafaf9" stroke="#292524" strokeWidth="1.8" />
      <path d="M248 94.5 L249.5 94.5" stroke="#292524" strokeWidth="1.8" strokeLinecap="round" />
      {/* eyes, looking down at the lost bookmark */}
      <circle cx="243.5" cy="97" r="1.9" fill="#1c1917" />
      <circle cx="256" cy="97" r="1.9" fill="#1c1917" />
      {/* puzzled mouth and a little blush */}
      <path d="M245 105 Q 249 103, 253 105.5" fill="none" stroke="#14532d" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="238" cy="102" r="2.2" fill="#86efac" />

      {/* a question mark floating above */}
      <text x="272" y="64" fontFamily="Georgia, 'Times New Roman', serif" fontSize="26" fontWeight="700" fill="#a8a29e">?</text>
    </svg>
  );
}
