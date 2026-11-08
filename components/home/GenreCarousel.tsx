// components/home/GenreCarousel.tsx
'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { ProductCard, BookCardData } from './ProductCard';

interface GenreCarouselProps {
  categoryName: string;
  categorySlug: string;
  books: BookCardData[];
}

export const GenreCarousel: React.FC<GenreCarouselProps> = ({
  categoryName,
  categorySlug,
  books,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  if (!books || books.length === 0) return null;

  return (
    <section className="mb-12">
      {/* Category Section Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-stone-900">
            {categoryName}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">Curated selections and trending titles</p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* shadcn Button: Variant "Ghost" with Icon Arrow */}
          <Link
            href={`/categories/${categorySlug}`}
            className="inline-flex items-center justify-center gap-1 h-8 px-3 rounded-md text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
          >
            <span>See all</span>
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>

          {/* shadcn Button: Variant "Outline" Icon Chevrons */}
          <button
            onClick={() => scroll('left')}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-stone-200 bg-white text-stone-700 shadow-2xs hover:bg-stone-100 hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => scroll('right')}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-stone-200 bg-white text-stone-700 shadow-2xs hover:bg-stone-100 hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900"
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Carousel Track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {books.map((book) => (
          <ProductCard key={book.bookId} book={book} />
        ))}
      </div>
    </section>
  );
};