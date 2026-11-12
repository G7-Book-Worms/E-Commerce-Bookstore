// context/CartContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface CartContextType {
  cartCount: number;
  cartItemIds: Set<number>;
  toggleCartItem: (bookId: number) => Promise<boolean>;
  isInCart: (bookId: number) => boolean;
  refreshCart: () => Promise<void>;
}

// Shape of `data` in every /api/cart response
interface CartResponseData {
  items: { bookId: number; quantity: number }[];
  totalCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItemIds, setCartItemIds] = useState<Set<number>>(new Set());

  // Mirror the server cart into local state
  const applyServerCart = (data: CartResponseData | undefined) => {
    if (!data) return;
    setCartCount(data.totalCount ?? 0);
    setCartItemIds(new Set((data.items ?? []).map((i) => i.bookId)));
  };

  // Load the logged-in user's cart (guests get 401 and simply see an empty cart)
  const refreshCart = useCallback(async () => {
    try {
      const res = await fetch('/api/cart', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        setCartCount(0);
        setCartItemIds(new Set());
        return;
      }
      const json = await res.json();
      applyServerCart(json?.data);
    } catch {
      // Network error: keep whatever we had
    }
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

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

  const isInCart = (bookId: number) => cartItemIds.has(bookId);

  return (
    <CartContext.Provider value={{ cartCount, cartItemIds, toggleCartItem, isInCart, refreshCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
