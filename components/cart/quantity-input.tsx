'use client';

// The number in a cart quantity control, typed into directly. It commits on Enter or when the
// box loses focus; Escape puts the old number back. lib/quantity.ts decides what is allowed:
// whole numbers only, 0 removes the line, and too many is lowered to what's in stock. Anything
// refused or lowered is explained in a toast (one per line, shaking if it keeps happening).
import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/components/toast';
import { limitMessage, parseQuantity } from '@/lib/quantity';

export function QuantityInput({
  quantity,
  stock,
  edition,
  title,
  disabled,
  onCommit,
  toastKey,
  className = '',
}: {
  quantity: number;
  stock: number;
  /** "Paperback" / "Hardcover", for the messages */
  edition?: string;
  /** Book title, for the label a screen reader reads */
  title: string;
  disabled?: boolean;
  /**
   * Called with the new quantity (0 = remove) when it differs from the current one. Return (or
   * resolve to) false when the change didn't go through, and the box shows the real number again.
   */
  onCommit: (quantity: number) => boolean | void | Promise<boolean | void>;
  /** Groups this line's warnings into one toast */
  toastKey: string;
  className?: string;
}) {
  const [text, setText] = useState(String(quantity));
  const focused = useRef(false);
  const cancelled = useRef(false);
  const latest = useRef(quantity);

  // A change from elsewhere (the + and − buttons, the server) replaces what's in the box, but
  // never while someone is typing in it
  useEffect(() => {
    // Disabled while focused (another change is saving): no blur may come, so stop treating it as typing
    if (disabled) focused.current = false;
  }, [disabled]);
  useEffect(() => {
    latest.current = quantity;
    if (!focused.current) setText(String(quantity));
  }, [quantity]);

  async function commit() {
    focused.current = false;
    if (cancelled.current) {
      // Escape: put the old number back and send nothing
      cancelled.current = false;
      setText(String(latest.current));
      return;
    }
    const r = parseQuantity(text, stock);
    if (!r.ok) {
      showToast(r.reason, { tone: 'warn', key: toastKey });
      setText(String(latest.current));
      return;
    }
    if (r.clampedTo !== undefined) {
      showToast(`${limitMessage(r.clampedTo, edition)} Your cart now has ${r.clampedTo}.`, { tone: 'warn', key: toastKey });
    }
    setText(String(r.value));
    if (r.value === latest.current) return;
    const ok = await onCommit(r.value);
    // Refused or failed (stock changed, network): show the quantity the cart really has
    if (ok === false) setText(String(latest.current));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={4}
      value={text}
      disabled={disabled}
      aria-label={`Number of ${edition ? `${edition.toLowerCase()} ` : ''}copies of ${title}`}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          cancelled.current = true;
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`h-8 w-10 rounded border border-transparent bg-transparent text-center tabular-nums hover:border-stone-300 focus:border-stone-400 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-60 ${className}`}
    />
  );
}
