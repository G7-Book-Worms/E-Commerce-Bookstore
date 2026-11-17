'use client';

// Street-address field with suggestions (Session 5). From the third character, each pause in
// typing asks /api/address/suggest for matching US addresses; picking one fills in the address
// through onSelect (use fillAddress below so a partial match only fills what it knows). It is only
// ever a shortcut: if the lookup is slow, fails or finds nothing, the field is an ordinary text
// input and the shopper types the address as before.
//
// Follows the WAI-ARIA combobox pattern: the input owns a listbox, ↑/↓ move through the options,
// Enter picks one, Escape closes the list (keeping what was typed). Editing the street again
// after picking brings suggestions back.

import { useEffect, useId, useRef, useState } from 'react';
import type { AddressSuggestion } from '@/server/src/modules/address/address-suggest';

// Mirrors MIN_QUERY_LENGTH in address-suggest.ts (that module is server code, so it is not
// imported here); the server enforces it again anyway.
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 220;

/** Same clean-up the server does, so cache keys match what is actually looked up. */
const normalize = (raw: string) => raw.replace(/\s+/g, ' ').trim();

type AddressFields = { street: string; city: string; state: string; zip: string; country: string };

/**
 * Applies a picked suggestion to an address form. Fields the suggestion has overwrite the form;
 * fields it doesn't have (a partial match while typing may have no postcode or city) keep what
 * the shopper typed, except that a postcode from a different city is cleared rather than left
 * pointing at the wrong place. Other form state (such as a default-address flag) is kept.
 */
export function fillAddress<T extends AddressFields>(prev: T, s: AddressSuggestion): T {
  const movedCity = !!s.city && s.city.toLowerCase() !== prev.city.trim().toLowerCase();
  return {
    ...prev,
    street: s.street,
    city: s.city || prev.city,
    state: s.state || prev.state,
    zip: s.zip || (movedCity ? '' : prev.zip),
    country: s.country || prev.country,
  };
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  autoComplete?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
}

type Status = 'idle' | 'loading' | 'ready';

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  autoComplete = 'street-address',
  required,
  maxLength = 100,
  className = 'flex flex-col gap-1 text-sm',
  labelClassName = 'font-medium',
  inputClassName = 'h-9 w-full rounded-md border px-3',
}: Props) {
  const id = useId();
  const listId = `${id}-suggestions`;
  const hintId = `${id}-hint`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // `query` only changes when the shopper types, never when a picked suggestion fills the field,
  // so picking doesn't trigger another lookup but any later edit does.
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [needsNumber, setNeedsNumber] = useState(false);
  // Answers already fetched in this page view: backspacing over text shows them again instantly.
  const cache = useRef(new Map<string, AddressSuggestion[]>());

  useEffect(() => {
    if (query.length < MIN_QUERY_LENGTH || cache.current.has(query)) return;
    // A newer keystroke aborts the older request, so a slow early answer can't overwrite a later one.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/address/suggest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q: query }),
          signal: controller.signal,
        });
        if (!res.ok) {
          // Rate-limited or unavailable: quietly no suggestions; the field still works.
          setSuggestions([]);
          setStatus('idle');
          return;
        }
        const body = await res.json();
        const list: AddressSuggestion[] = body?.data?.suggestions ?? [];
        cache.current.set(query, list);
        setSuggestions(list);
        setActive(-1);
        setStatus('ready');
      } catch {
        // Aborted (a newer keystroke took over) or offline. Only the offline case needs clearing.
        if (!controller.signal.aborted) setStatus('idle');
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Clicking anywhere outside the field and its list closes the list.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const handleInput = (raw: string) => {
    onChange(raw);
    setNeedsNumber(false);
    const q = normalize(raw);
    setQuery(q);
    setActive(-1);
    if (q.length < MIN_QUERY_LENGTH) {
      setOpen(false);
      setSuggestions([]);
      setStatus('idle');
      return;
    }
    setOpen(true);
    const cached = cache.current.get(q);
    if (cached) {
      setSuggestions(cached);
      setStatus('ready');
    } else {
      // Keep showing the previous matches while the new ones load, so the list doesn't blink.
      setStatus('loading');
    }
  };

  const pick = (s: AddressSuggestion) => {
    onSelect(s);
    setOpen(false);
    setActive(-1);
    if (s.needsNumber) {
      // A street without a number: put the cursor at the start so the number can be typed next.
      setNeedsNumber(true);
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(0, 0);
      });
    }
  };

  const showList = open && suggestions.length > 0;
  const showPanel = open && query.length >= MIN_QUERY_LENGTH && (showList || status !== 'idle');

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (!showPanel) return; // nothing open: let Escape reach e.g. a surrounding dialog
      // Close the list but keep what was typed.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!showList) {
        // Re-open a list that was closed with Escape (or by picking) for the same text.
        if (suggestions.length > 0 && query.length >= MIN_QUERY_LENGTH) {
          e.preventDefault();
          setOpen(true);
          setActive(e.key === 'ArrowDown' ? 0 : suggestions.length - 1);
        }
        return;
      }
      e.preventDefault();
      setActive((i) =>
        e.key === 'ArrowDown' ? (i + 1) % suggestions.length : i <= 0 ? suggestions.length - 1 : i - 1
      );
      return;
    }
    if (e.key === 'Enter' && showList && active >= 0) {
      // Pick the highlighted suggestion instead of submitting the form.
      e.preventDefault();
      pick(suggestions[active]);
    }
  };

  // Announced to screen readers; sighted shoppers see the list itself.
  const announcement = !showPanel
    ? ''
    : status === 'loading' && suggestions.length === 0
      ? 'Searching for addresses'
      : suggestions.length > 0
        ? `${suggestions.length} address suggestion${suggestions.length === 1 ? '' : 's'}. Use up and down arrows to choose.`
        : 'No matching addresses';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label htmlFor={id} className={labelClassName}>{label}</label>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={needsNumber ? hintId : undefined}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className={inputClassName}
      />
      {needsNumber && (
        <p id={hintId} className="text-xs text-amber-800">Add the house number at the start of the street.</p>
      )}
      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-stone-200 bg-white text-sm shadow-lg">
          {status === 'loading' && suggestions.length === 0 && (
            <p className="flex items-center gap-2 px-3 py-2 text-stone-500" aria-hidden>
              <span className="size-3 animate-spin rounded-full border-2 border-stone-300 border-t-stone-600" />
              Searching…
            </p>
          )}
          {status === 'ready' && suggestions.length === 0 && (
            <p className="px-3 py-2 text-stone-500" aria-hidden>
              No matching addresses. Keep typing, or fill in the address yourself.
            </p>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-label="Address suggestions"
            hidden={!showList}
            className={`max-h-64 overflow-auto py-1 transition-opacity ${status === 'loading' ? 'opacity-60' : ''}`}
          >
            {suggestions.map((s, i) => (
              <li
                key={`${s.street}|${s.city}|${s.zip}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mousedown, not click: it fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-stone-100' : ''}`}
              >
                {s.label}
                {s.needsNumber && <span className="ml-1 text-xs text-stone-500">(add number)</span>}
              </li>
            ))}
          </ul>
          {showList && (
            <p className="flex items-center justify-between gap-2 border-t border-stone-100 bg-stone-50 px-3 py-1.5 text-[11px] text-stone-500" aria-hidden>
              <span>↑↓ to choose · Enter to select · Esc to close</span>
              {status === 'loading' && <span>Searching…</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
