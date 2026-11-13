// components/header/Header.tsx
'use client';

// Store header, laid out like the B&N site:
//   row 1: logo · search · account · cart
//   row 2: category bar (Books button + collections), scrolls sideways on phones

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Search, ShoppingCart, User } from 'lucide-react';
import { useCart } from '@/app/context/CartContext';
import { useAuth } from '@/app/context/auth-context';

// Category bar links. match = the URL query that marks the link as the current page
const NAV = [
  { href: '/product-catalog/all?section=bestseller', label: 'Bestsellers', match: 'section=bestseller' },
  { href: '/product-catalog/all?section=new-release', label: 'New Releases', match: 'section=new-release' },
  { href: '/product-catalog/all?section=coming-soon', label: 'Coming Soon', match: 'section=coming-soon' },
  { href: '/product-catalog/all?section=special-edition', label: 'Exclusives', match: 'section=special-edition' },
  { href: '/product-catalog/all?onSale=true', label: 'On Sale', match: 'onSale=true' },
  { href: '/product-catalog/all?genre=fiction', label: 'Fiction', match: 'genre=fiction' },
  { href: '/product-catalog/all?genre=nonfiction', label: 'Nonfiction', match: 'genre=nonfiction' },
];

// Header search: Enter goes to the See All page with ?q=, which searches title, author, ISBN and description
function SearchBox() {
  const router = useRouter();
  // Keep the search box filled in on the results page
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/product-catalog/all?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearchSubmit} role="search" className="relative flex w-full items-center">
      <Search className="pointer-events-none absolute left-3 size-4 text-stone-400" aria-hidden />
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        type="search"
        aria-label="Search books"
        placeholder="Title, author, keyword or ISBN"
        className="h-10 w-full rounded-full border border-stone-300 bg-white pl-10 pr-24 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
      />
      <button
        type="submit"
        className="absolute right-1 h-8 rounded-full bg-stone-900 px-4 text-xs font-semibold text-white hover:bg-stone-800"
      >
        Search
      </button>
    </form>
  );
}

// Category bar. Highlights the link for the page you're on
function CategoryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const onBooksHome = pathname === '/product-catalog';

  return (
    <nav aria-label="Shop by category" className="border-t border-stone-200 bg-stone-50">
      <ul className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        <li className="shrink-0">
          <Link
            href="/product-catalog"
            aria-current={onBooksHome ? 'page' : undefined}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800"
          >
            <BookOpen className="size-4" aria-hidden /> Books
          </Link>
        </li>
        <li aria-hidden className="mx-1 h-5 w-px shrink-0 bg-stone-300" />
        {NAV.map((item) => {
          const active = pathname === '/product-catalog/all' && query === item.match;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-8 items-center rounded-full px-3 text-sm transition ${
                  active ? 'bg-white font-semibold text-stone-900 shadow-xs ring-1 ring-stone-300' : 'text-stone-700 hover:bg-white hover:text-stone-900'
                } ${item.label === 'On Sale' ? 'text-red-700' : ''}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const Header: React.FC = () => {
  const { cartCount } = useCart();
  const { user, isLoading } = useAuth();

  // Extract display name only if an active user exists
  const userName = user ? user.firstName || user.name?.split(' ')[0] || 'Account' : '';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-white/95 backdrop-blur-xs text-stone-900">
      <div className="max-w-7xl mx-auto grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 md:grid-cols-[auto_1fr_auto] lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-stone-900">
          <span className="text-2xl" aria-hidden>📚</span>
          <span className="text-lg font-bold font-serif">Book Worms</span>
        </Link>

        {/* Search: middle column on tablets/laptops, its own row on phones */}
        <div className="order-last col-span-2 md:order-none md:col-span-1">
          <Suspense fallback={<div className="h-10 rounded-full border border-stone-200" />}>
            <SearchBox />
          </Suspense>
        </div>

        {/* Account + cart */}
        <div className="flex items-center justify-end gap-2">
          {isLoading ? (
            <div className="h-10 w-24 rounded-md bg-stone-100 animate-pulse" />
          ) : user ? (
            <Link
              href="/account"
              className="h-10 px-3 rounded-md hover:bg-stone-100 text-sm font-medium inline-flex items-center gap-2 transition"
            >
              <span className="w-7 h-7 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-xs font-semibold">
                {userName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden sm:flex flex-col leading-tight">
                <span className="text-[11px] text-stone-500">Hi, {userName}</span>
                <span>My Account</span>
              </span>
            </Link>
          ) : (
            <>
              <Link
                href="/user-login"
                className="h-10 px-3 rounded-md hover:bg-stone-100 text-sm font-medium inline-flex items-center gap-2 transition"
              >
                <User className="size-4" aria-hidden />
                <span>Sign In</span>
              </Link>
              <Link
                href="/user-register"
                className="hidden sm:inline-flex h-10 px-4 rounded-md bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-medium items-center transition"
              >
                Create Account
              </Link>
            </>
          )}

          <Link
            href="/cart"
            className="relative h-10 w-10 rounded-md hover:bg-stone-100 inline-flex items-center justify-center transition"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
          >
            <ShoppingCart className="size-5" aria-hidden />
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-red-700 text-[11px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="h-12 border-t border-stone-200 bg-stone-50" />}>
        <CategoryNav />
      </Suspense>
    </header>
  );
};
