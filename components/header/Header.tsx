// components/header/Header.tsx
'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/app/context/CartContext';
import { useAuth } from '@/app/context/auth-context';

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
    <form onSubmit={handleSearchSubmit} role="search" className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-md sm:mx-2">
      <div className="relative flex items-center">
        <svg
          className="absolute left-3 w-4 h-4 text-stone-400 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          type="search"
          aria-label="Search books"
          placeholder="Search by title, author, keyword, ISBN..."
          className="h-9 w-full rounded-md border border-stone-200 bg-transparent pl-9 pr-3 text-sm sm:text-xs placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
        />
      </div>
    </form>
  );
}

export const Header: React.FC = () => {
  const { cartCount } = useCart();
  const { user, isLoading } = useAuth();

  // Extract display name only if an active user exists
  const userName = user
    ? user.firstName || user.name?.split(' ')[0] || 'Account'
    : '';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 bg-white/95 backdrop-blur-xs text-stone-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-0 sm:h-14 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-4 gap-y-2">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-stone-900"
        >
          <span className="text-xl">📚</span>
          <span className="text-base font-bold font-serif">Book Worms</span>
        </Link>
        <Link href="/product-catalog" className="hidden md:inline text-sm font-medium text-stone-700 hover:text-stone-900 hover:underline">
          Books
        </Link>

        {/* Search (own component so useSearchParams can sit in a Suspense boundary) */}
        <Suspense fallback={<div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-md h-9" />}>
          <SearchBox />
        </Suspense>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Cart Quick-Access */}
          <Link
            href="/cart"
            className="relative h-9 px-3 rounded-md border border-stone-200 bg-white text-stone-900 hover:bg-stone-100 inline-flex items-center justify-center transition"
            aria-label="View Cart"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-stone-900 text-stone-50">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          {/* Account / Auth Button */}
          {isLoading ? (
            <div className="h-9 w-24 bg-stone-100 rounded-md animate-pulse" />
          ) : user ? (
            <Link
              href="/account"
              className="h-9 px-3 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-900 text-xs font-medium inline-flex items-center gap-2 transition"
            >
              <span className="w-5 h-5 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-[10px] font-semibold">
                {userName.charAt(0).toUpperCase()}
              </span>
              <span>{userName}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/user-login"
                className="h-9 px-3 rounded-md border border-stone-200 bg-white hover:bg-stone-100 text-stone-900 text-xs font-medium inline-flex items-center gap-2 transition"
              >
                <svg
                  className="w-4 h-4 text-stone-700 shrink-0 hidden sm:block"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Sign In</span>
              </Link>
              <Link
                href="/user-register"
                className="h-9 px-3 rounded-md bg-stone-900 hover:bg-stone-800 text-stone-50 text-xs font-medium inline-flex items-center transition"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};