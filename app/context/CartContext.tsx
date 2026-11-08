// context/CartContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface CartContextType {
  cartCount: number;
  cartItemIds: Set<number>;
  toggleCartItem: (bookId: number) => Promise<boolean>;
  isInCart: (bookId: number) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItemIds, setCartItemIds] = useState<Set<number>>(new Set());

  // SCRUM-137: Toggle add / remove on card click
  const toggleCartItem = async (bookId: number): Promise<boolean> => {
    const isCurrentlyInCart = cartItemIds.has(bookId);

    if (isCurrentlyInCart) {
      // Optimistic removal
      setCartItemIds((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
      setCartCount((prev) => Math.max(0, prev - 1));

      try {
        const res = await fetch('/api/cart', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId }),
        });
        const data = await res.json();
        if (data?.data?.totalCount !== undefined) {
          setCartCount(data.data.totalCount);
        }
      } catch {
        // Rollback on failure
        setCartItemIds((prev) => new Set(prev).add(bookId));
        setCartCount((prev) => prev + 1);
      }
      return false;
    } else {
      // Optimistic addition
      setCartItemIds((prev) => new Set(prev).add(bookId));
      setCartCount((prev) => prev + 1);

      try {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, quantity: 1 }),
        });
        const data = await res.json();
        if (data?.data?.totalCount !== undefined) {
          setCartCount(data.data.totalCount);
        }
      } catch {
        // Rollback on failure
        setCartItemIds((prev) => {
          const next = new Set(prev);
          next.delete(bookId);
          return next;
        });
        setCartCount((prev) => Math.max(0, prev - 1));
      }
      return true;
    }
  };

  const isInCart = (bookId: number) => cartItemIds.has(bookId);

  return (
    <CartContext.Provider value={{ cartCount, cartItemIds, toggleCartItem, isInCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};