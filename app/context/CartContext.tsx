// context/CartContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';

export type CartFormat = 'hardcover' | 'paperback';

/** One cart line as the catalogue and product page need it: a book, a format, a quantity */
export interface CartLineSummary {
  bookId: number;
  format: CartFormat;
  quantity: number;
}

interface CartContextType {
  cartCount: number;
  cartItemIds: Set<number>;
  toggleCartItem: (bookId: number) => Promise<boolean>;
  /** Adds copies of one format. Resolves to an error message, or null on success */
  addToCart: (bookId: number, format: 'hardcover' | 'paperback', quantity: number) => Promise<string | null>;
  isInCart: (bookId: number) => boolean;
  refreshCart: () => Promise<void>;
  /** Lets the cart page push the fresh cart after it changes something */
  applyServerCart: (data: CartResponseData | undefined) => void;
  /** SCRUM: catalogue stepper. Every line in the cart, per book AND format */
  cartLines: CartLineSummary[];
  /** The lines for one book — one per format it is in the cart in */
  linesForBook: (bookId: number) => CartLineSummary[];
  /** Copies of one book in the cart: of one format, or of every format when none is given */
  quantityOf: (bookId: number, format?: CartFormat) => number;
  /**
   * Sets the quantity of one book+format line. 0 removes the line.
   * Resolves to an error message, or null on success.
   */
  setCartQuantity: (bookId: number, format: CartFormat, quantity: number) => Promise<string | null>;
}

// Shape of `data` in every /api/cart response
interface CartResponseData {
  items: { bookId: number; quantity: number; format?: CartFormat }[];
  totalCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItemIds, setCartItemIds] = useState<Set<number>>(new Set());
  // Quantity per book AND format, so the catalogue stepper knows which line it is adjusting
  const [cartLines, setCartLines] = useState<CartLineSummary[]>([]);

  // Mirror the server cart into local state
  const applyServerCart = useCallback((data: CartResponseData | undefined) => {
    if (!data) return;
    setCartCount(data.totalCount ?? 0);
    setCartItemIds(new Set((data.items ?? []).map((i) => i.bookId)));
    setCartLines(
      (data.items ?? []).map((i) => ({
        bookId: i.bookId,
        // Older responses (and the guest cart) may not carry a format; paperback is the default edition
        format: i.format ?? 'paperback',
        quantity: i.quantity,
      }))
    );
  }, []);

  // Load the logged-in user's cart (guests get 401 and simply see an empty cart)
  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch('/api/cart', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        setCartCount(0);
        setCartItemIds(new Set());
        setCartLines([]);
        return;
      }
      const json = await res.json();
      applyServerCart(json?.data);
    } catch {
      // Network error: keep whatever we had
    }
  }, [applyServerCart]);

  // Only signed-in shoppers have a cart (guests would just get a 401 from /api/cart)
  const { user, isLoading } = useAuth();
  useEffect(() => {
    if (isLoading) return;
    if (user) refreshCart();
    else {
      setCartCount(0);
      setCartItemIds(new Set());
      setCartLines([]);
    }
  }, [user, isLoading, refreshCart]);

  // SCRUM-137: Toggle add / remove on card click
  const toggleCartItem = async (bookId: number): Promise<boolean> => {
    const isCurrentlyInCart = cartItemIds.has(bookId);
    const previousIds = cartItemIds;
    const previousCount = cartCount;

    const rollback = () => {
      setCartItemIds(previousIds);
      setCartCount(previousCount);
    };

    if (isCurrentlyInCart) {
      // Optimistic removal
      setCartItemIds((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
      setCartCount((prev) => Math.max(0, prev - 1));
    } else {
      // Optimistic addition
      setCartItemIds((prev) => new Set(prev).add(bookId));
      setCartCount((prev) => prev + 1);
    }

    try {
      const res = await fetch('/api/cart', {
        method: isCurrentlyInCart ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(isCurrentlyInCart ? { bookId } : { bookId, quantity: 1 }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // e.g. 401 when logged out, 400 when out of stock
        rollback();
        if (res.status === 401 && typeof window !== 'undefined') {
          window.location.href = `/user-login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
        }
        return isCurrentlyInCart;
      }
      applyServerCart(json?.data);
      return !isCurrentlyInCart;
    } catch {
      rollback();
      return isCurrentlyInCart;
    }
  };

  const addToCart = async (bookId: number, format: 'hardcover' | 'paperback', quantity: number) => {
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookId, format, quantity }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        window.location.href = `/user-login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
        return 'Please sign in to add books to your cart';
      }
      if (!res.ok) return json?.error || 'Could not add this book to your cart';
      applyServerCart(json?.data);
      return null;
    } catch {
      return 'Network error. Please try again.';
    }
  };

  const isInCart = (bookId: number) => cartItemIds.has(bookId);

  // --- Quantity per book + format (catalogue and product-page stepper) ---

  const linesForBook = (bookId: number) => cartLines.filter((l) => l.bookId === bookId);

  const quantityOf = (bookId: number, format?: CartFormat) =>
    cartLines.reduce((sum, l) => (l.bookId === bookId && (!format || l.format === format) ? sum + l.quantity : sum), 0);

  /**
   * Sets one line's quantity. 0 removes the line (DELETE); anything else is a PATCH, which
   * the API rejects when the shopper asks for more copies than are in stock.
   */
  const setCartQuantity = async (bookId: number, format: CartFormat, quantity: number): Promise<string | null> => {
    const next = Math.max(0, Math.floor(quantity));
    try {
      const res = await fetch('/api/cart', {
        method: next === 0 ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(next === 0 ? { bookId, format } : { bookId, format, quantity: next }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = `/user-login?callbackUrl=${encodeURIComponent(window.location.pathname)}`;
        }
        return 'Please sign in to change your cart';
      }
      if (!res.ok) {
        // Out of stock, or the line went away in another tab: re-sync so the UI tells the truth
        await refreshCart();
        return json?.error || 'Could not update your cart';
      }
      applyServerCart(json?.data);
      return null;
    } catch {
      return 'Network error. Please try again.';
    }
  };

  return (
    <CartContext.Provider
      value={{
        cartCount,
        cartItemIds,
        toggleCartItem,
        addToCart,
        isInCart,
        refreshCart,
        applyServerCart,
        cartLines,
        linesForBook,
        quantityOf,
        setCartQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
