// context/CartContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './auth-context';

/** A guest's cart line. No prices: the server re-prices every line from the book id and format. */
export interface GuestCartLine {
  bookId: number;
  format?: 'hardcover' | 'paperback';
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

  // --- guest checkout (SCRUM-208) ---
  /** True once we know nobody is signed in: the cart below is the browser's own. */
  isGuest: boolean;
  /** The guest's cart as stored in localStorage (empty when signed in). */
  guestItems: GuestCartLine[];
  /** Sets one line's exact quantity; 0 removes it. */
  setGuestQuantity: (bookId: number, format: 'hardcover' | 'paperback' | undefined, quantity: number) => void;
  removeGuestItem: (bookId: number, format?: 'hardcover' | 'paperback') => void;
  clearGuestCart: () => void;
}

// Shape of `data` in every /api/cart response
interface CartResponseData {
  items: { bookId: number; quantity: number }[];
  totalCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// --- the guest cart in localStorage --------------------------------------------------------
const GUEST_KEY = 'bookworms.guestCart';
const GUEST_MAX_LINES = 20; // mirrors GUEST_CART_MAX_LINES on the server
const GUEST_MAX_QUANTITY = 99; // mirrors GUEST_CART_MAX_QUANTITY on the server

function readGuestCart(): GuestCartLine[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything that isn't a plausible line is dropped here, and the server validates again.
    return parsed
      .filter(
        (l): l is GuestCartLine =>
          !!l &&
          typeof l === 'object' &&
          Number.isInteger((l as GuestCartLine).bookId) &&
          (l as GuestCartLine).bookId > 0 &&
          Number.isInteger((l as GuestCartLine).quantity) &&
          (l as GuestCartLine).quantity > 0
      )
      .map((l) => ({
        bookId: l.bookId,
        format: l.format === 'hardcover' || l.format === 'paperback' ? l.format : undefined,
        quantity: Math.min(GUEST_MAX_QUANTITY, l.quantity),
      }))
      .slice(0, GUEST_MAX_LINES);
  } catch {
    // Storage blocked (private mode) or corrupt JSON: start from an empty cart.
    return [];
  }
}

function writeGuestCart(lines: GuestCartLine[]) {
  try {
    if (lines.length === 0) localStorage.removeItem(GUEST_KEY);
    else localStorage.setItem(GUEST_KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked: the cart just won't survive a reload.
  }
}

/** Same rule as mergeGuestLines on the server: one line per book-and-format, quantities summed. */
function mergeLines(lines: GuestCartLine[]): GuestCartLine[] {
  const byKey = new Map<string, GuestCartLine>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) continue;
    const key = `${line.bookId}:${line.format ?? ''}`;
    const existing = byKey.get(key);
    if (existing) existing.quantity = Math.min(GUEST_MAX_QUANTITY, existing.quantity + line.quantity);
    else byKey.set(key, { ...line, quantity: Math.min(GUEST_MAX_QUANTITY, line.quantity) });
  }
  return [...byKey.values()].slice(0, GUEST_MAX_LINES);
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartCount, setCartCount] = useState<number>(0);
  const [cartItemIds, setCartItemIds] = useState<Set<number>>(new Set());
  const [guestItems, setGuestItems] = useState<GuestCartLine[]>([]);

  // Mirror the server cart into local state
  const applyServerCart = useCallback((data: CartResponseData | undefined) => {
    if (!data) return;
    setCartCount(data.totalCount ?? 0);
    setCartItemIds(new Set((data.items ?? []).map((i) => i.bookId)));
  }, []);

  // Load the logged-in user's cart (guests get 401 and keep their localStorage cart)
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
  }, [applyServerCart]);

  // Save the guest cart and keep the header's badge in step with it
  const commitGuestCart = useCallback((next: GuestCartLine[]) => {
    const merged = mergeLines(next);
    setGuestItems(merged);
    writeGuestCart(merged);
    setCartCount(merged.reduce((sum, l) => sum + l.quantity, 0));
    setCartItemIds(new Set(merged.map((l) => l.bookId)));
    return merged;
  }, []);

  /**
   * Signing in or registering with items in the guest cart: replay each line through
   * POST /api/cart, which adds to the quantity already in the account's cart for that
   * book-and-format instead of creating a second line. Lines are merged first so one book is
   * posted once, and the server re-checks format, stock and price for every line.
   */
  const mergeGuestCartIntoAccount = useCallback(async () => {
    const lines = mergeLines(readGuestCart());
    if (lines.length === 0) return;
    for (const line of lines) {
      try {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ bookId: line.bookId, format: line.format, quantity: line.quantity }),
        });
        // A line that no longer fits (sold out, format withdrawn) is skipped rather than
        // blocking the rest of the merge; the cart page shows what actually made it.
        if (!res.ok) console.warn('[cart] a guest cart line could not be merged', { bookId: line.bookId });
      } catch {
        // Offline: leave the guest cart in place so the merge can be retried on the next sign-in.
        return;
      }
    }
    writeGuestCart([]);
    setGuestItems([]);
  }, []);

  const { user, isLoading, refreshSession } = useAuth();
  /** Nobody is signed in: the cart is this browser's own and checkout runs as a guest. */
  const isGuest = !isLoading && !user;

  const mergedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      // Merge the browser's cart into the account once per sign-in, then show the server cart.
      const key = String(user.id);
      if (mergedForUser.current !== key) {
        mergedForUser.current = key;
        mergeGuestCartIntoAccount().finally(() => {
          setGuestItems([]);
          refreshCart();
        });
      } else {
        refreshCart();
      }
    } else {
      // Signed out: load the cart this browser is holding.
      mergedForUser.current = null;
      commitGuestCart(readGuestCart());
    }
  }, [user, isLoading, refreshCart, mergeGuestCartIntoAccount, commitGuestCart]);

  // SCRUM-137: Toggle add / remove on card click
  const toggleCartItem = async (bookId: number): Promise<boolean> => {
    const isCurrentlyInCart = cartItemIds.has(bookId);

    // Guests: toggle the line in localStorage. No format is chosen here, so the server picks
    // the cheapest format in stock when the cart is priced (same rule as the signed-in cart).
    if (isGuest) {
      commitGuestCart(
        isCurrentlyInCart
          ? guestItems.filter((l) => l.bookId !== bookId)
          : [...guestItems, { bookId, quantity: 1 }]
      );
      return !isCurrentlyInCart;
    }

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
        // e.g. 401 when the session ended, 400 when out of stock
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
    // Guests keep their cart in this browser and can check out without registering.
    if (isGuest) {
      commitGuestCart([...guestItems, { bookId, format, quantity }]);
      return null;
    }
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookId, format, quantity }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 401) {
        // The session ended while shopping: keep the book by putting it in the guest cart, and
        // let the auth context notice so the UI switches to guest mode.
        commitGuestCart([...readGuestCart(), { bookId, format, quantity }]);
        refreshSession();
        return null;
      }
      if (!res.ok) return json?.error || 'Could not add this book to your cart';
      applyServerCart(json?.data);
      return null;
    } catch {
      return 'Network error. Please try again.';
    }
  };

  /**
   * A line added from a book tile has no format: the server resolves it to the cheapest format in
   * stock when it prices the cart. The cart and checkout pages therefore know a concrete format
   * for a line that is still stored without one, so "this book in this format" has to match the
   * format-less line too — otherwise setting a quantity would leave the old line behind and the
   * two would be summed back together at pricing time.
   */
  const sameLine = (l: GuestCartLine, bookId: number, format?: 'hardcover' | 'paperback') =>
    l.bookId === bookId && (format === undefined || l.format === format || l.format === undefined);

  const setGuestQuantity = (
    bookId: number,
    format: 'hardcover' | 'paperback' | undefined,
    quantity: number
  ) => {
    const others = guestItems.filter((l) => !sameLine(l, bookId, format));
    commitGuestCart(quantity > 0 ? [...others, { bookId, format, quantity }] : others);
  };

  const removeGuestItem = (bookId: number, format?: 'hardcover' | 'paperback') => {
    commitGuestCart(guestItems.filter((l) => !sameLine(l, bookId, format)));
  };

  const clearGuestCart = () => commitGuestCart([]);

  const isInCart = (bookId: number) => cartItemIds.has(bookId);

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
        isGuest,
        guestItems,
        setGuestQuantity,
        removeGuestItem,
        clearGuestCart,
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
