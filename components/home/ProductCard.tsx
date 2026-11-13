// components/home/ProductCard.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/app/context/CartContext';
import { BookCover } from '@/components/book-cover';
import { stockLabel } from '@/lib/catalog';

export interface BookCardData {
  bookId: number;
  title: string;
  author: string;
  price: string;
  isbn: string;
  stock: number;
  coverImageUrl?: string | null;
}

export const ProductCard: React.FC<{ book: BookCardData }> = ({ book }) => {
  const { toggleCartItem, isInCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const activeInCart = isInCart(book.bookId);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing || book.stock === 0) return;

    setIsProcessing(true);
    await toggleCartItem(book.bookId);
    setIsProcessing(false);
  };

  return (
    <div className="group relative flex-none w-48 sm:w-56 bg-white border border-stone-200 rounded-lg overflow-hidden shadow-xs hover:border-stone-400 transition flex flex-col justify-between">
      {/* Product Details Navigation */}
      <Link href={`/product/${encodeURIComponent(book.isbn)}`} className="block p-4">
        <div className="relative w-full aspect-2/3 overflow-hidden rounded-md border border-stone-200 bg-stone-100 transition group-hover:scale-[1.01]">
          <BookCover title={book.title} author={book.author} isbn={book.isbn} coverImageUrl={book.coverImageUrl} />
        </div>

        <div className="mt-3">
          <h3 className="font-medium text-stone-900 text-sm line-clamp-1 group-hover:underline">
            {book.title}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{book.author}</p>
          <p className={`text-xs mt-1 ${book.stock <= 0 ? 'text-red-700' : book.stock <= 3 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {stockLabel(book.stock)}
          </p>
        </div>
      </Link>

      <div className="px-4 pb-4 pt-2 flex items-center justify-between border-t border-stone-100">
        <span className="font-semibold text-stone-900 text-sm tracking-tight">${book.price}</span>

        {/* Dynamic Toggle Button: Checkmark when added, Plus when absent */}
        <button
          onClick={handleToggle}
          disabled={isProcessing || book.stock === 0}
          className={`h-8 px-3 rounded-md text-xs font-medium transition inline-flex items-center justify-center gap-1.5 ${
            activeInCart
              ? 'bg-stone-900 text-stone-50 hover:bg-stone-800'
              : 'border border-stone-200 bg-white text-stone-900 hover:bg-stone-100 hover:text-stone-900'
          } disabled:pointer-events-none disabled:opacity-50`}
          aria-label={activeInCart ? 'Remove from cart' : 'Add to cart'}
        >
          {isProcessing ? (
            <span className="animate-spin text-xs">·</span>
          ) : activeInCart ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Added</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};