'use client';

// A small "are you sure?" dialog (used to delete a saved address at checkout and in the account
// Addresses tab). Accessible modal: role="dialog" + aria-modal, labelled by its title and
// described by its body, Escape or Cancel closes it, focus moves into it (onto Cancel, the safe
// choice) and Tab stays inside it, and focus goes back to the button that opened it when it
// closes, if that button is still on the page. When it isn't (the item was deleted), the caller
// moves focus somewhere sensible.

import { useEffect, useId, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  /** What is about to happen, e.g. the full address being deleted */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirm button text while busy */
  busyLabel?: string;
  /** Shows the confirm button as working and stops the dialog closing meanwhile */
  busy?: boolean;
  /** An error from the last attempt, shown inside the dialog */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busyLabel = 'Deleting…',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus in on open; back to the opener on close (if it still exists)
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (!busy) onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the dialog
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/50 p-4"
      onMouseDown={(e) => {
        // A click on the backdrop (not inside the dialog) cancels
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? bodyId : undefined}
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-6 text-stone-900 shadow-xl"
      >
        <h2 id={titleId} className="font-serif text-lg font-bold">{title}</h2>
        {children && <div id={bodyId} className="mt-3 text-sm text-stone-700">{children}</div>}
        {error && <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-md border border-stone-300 px-4 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="h-9 rounded-md bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
