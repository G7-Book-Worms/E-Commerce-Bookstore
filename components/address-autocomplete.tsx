'use client';

// Street-address field with suggestions (Session 5). Typing three or more characters asks
// /api/address/suggest for matching US addresses; picking one fills in the whole address through
// onSelect. It is only ever a shortcut: if the lookup is slow, fails or finds nothing, the field
// is an ordinary text input and the shopper types the address as before.
//
// Follows the WAI-ARIA combobox pattern: the input owns a listbox, ↑/↓ move through the options,
// Enter picks one, Escape closes the list.

import { useEffect, useId, useRef, useState } from 'react';
import type { AddressSuggestion } from '@/server/src/modules/address/address-suggest';

// Mirrors MIN_QUERY_LENGTH in address-suggest.ts (that module is server code, so it is not
// imported here); the server enforces it again anyway.
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

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
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Only look things up for text the shopper typed - not when a picked suggestion fills the field.
  const typed = useRef(false);

  useEffect(() => {
    const query = value.trim();
    // Too short (the change handler has already closed the list) or not typed by the shopper.
    if (!typed.current || query.length < MIN_QUERY_LENGTH) return;
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
        if (!res.ok) return; // rate-limited or unavailable: just no suggestions
        const body = await res.json();
        const list: AddressSuggestion[] = body?.data?.suggestions ?? [];
        setSuggestions(list);
        setActive(-1);
        setOpen(list.length > 0);
      } catch {
        // Aborted or offline - leave the field as a plain input.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const pick = (s: AddressSuggestion) => {
    typed.current = false;
    onSelect(s);
    setOpen(false);
    setSuggestions([]);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      // Pick the highlighted suggestion instead of submitting the form.
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className={labelClassName}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        required={required}
        autoComplete={autoComplete}
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
          // Clearing here rather than in the effect keeps state updates in the event handler.
          if (e.target.value.trim().length < MIN_QUERY_LENGTH) {
            setOpen(false);
            setSuggestions([]);
            setActive(-1);
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        className={inputClassName}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border bg-white py-1 text-sm shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.street}|${s.zip}`}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
