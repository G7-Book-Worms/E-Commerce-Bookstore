"use client"; // Needs to run in the browser since the filters react to clicks and typing

// Filters, sorting, the book grid and page numbers for the See All page.
// Every choice is written to the URL; the server page reads the URL and asks the database,
// so filters always match real stock and prices, and the link can be shared.

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { BookCard, type Book } from "@/components/book-card";
import { Button } from "@/components/ui/button";
import { SORT_OPTIONS, type SortKey } from "@/lib/catalog";
import type { CatalogQuery } from "@/server/src/modules/books/catalog-repository";

// Each group is single choice so conflicting filters can't be picked together.
// To add a filter, add a line here. param/value become ?param=value in the URL
const FILTER_GROUPS = [
  {
    name: "Genre",
    param: "genre",
    options: [
      { value: "fiction", label: "Fiction" },
      { value: "nonfiction", label: "Nonfiction" },
      { value: "fantasy", label: "Fantasy" },
      { value: "science", label: "Science" },
      { value: "history", label: "History" },
      { value: "technology", label: "Technology" },
    ],
  },
  {
    name: "Format",
    param: "format",
    options: [
      { value: "hardcover", label: "Hardcover" },
      { value: "paperback", label: "Paperback" },
    ],
  },
  {
    name: "Collection",
    param: "section",
    options: [
      { value: "bestseller", label: "Bestsellers" },
      { value: "new-release", label: "New Releases" },
      { value: "coming-soon", label: "Coming Soon" },
      { value: "trending", label: "Trending" },
      { value: "special-edition", label: "Exclusives" },
      { value: "paperback-pick", label: "Paperback Picks" },
    ],
  },
  {
    name: "Rating",
    param: "minRating",
    options: [
      { value: "4.5", label: "4.5★ & up" },
      { value: "4", label: "4★ & up" },
      { value: "3", label: "3★ & up" },
    ],
  },
] as const;

const TOGGLES = [
  { param: "inStock", label: "In stock only" },
  { param: "onSale", label: "On sale" },
] as const;

// Turns what's typed in a price box (dollars) into cents for the URL. Empty or invalid = no limit
function toCents(value: string) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? String(Math.round(n * 100)) : null;
}
const toDollars = (cents?: number) => (cents === undefined ? "" : String(cents / 100));

type Props = { books: Book[]; total: number; page: number; totalPages: number; query: CatalogQuery };

export function BookBrowser({ books, total, page, totalPages, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showFilters, setShowFilters] = useState(false); // Filter drawer on phones
  // Price boxes are kept as text so they can be empty while typing
  const [minText, setMinText] = useState(toDollars(query.minPrice));
  const [maxText, setMaxText] = useState(toDollars(query.maxPrice));

  // Changes some URL params and reloads the results. Any filter change goes back to page 1
  function update(changes: Record<string, string | null>, keepPage = false) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!keepPage) next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: keepPage }));
  }

  function choose(param: string, value: string) {
    // Clicking the picked option turns it off. Clicking another one in the same group replaces it
    update({ [param]: searchParams.get(param) === value ? null : value });
  }

  // Applies the price boxes. Swaps min and max if min ends up higher
  function applyPrice() {
    let min = toCents(minText);
    let max = toCents(maxText);
    if (min && max && Number(min) > Number(max)) {
      [min, max] = [max, min];
      setMinText(toDollars(Number(min)));
      setMaxText(toDollars(Number(max)));
    }
    if (min !== searchParams.get("minPrice") || max !== searchParams.get("maxPrice")) {
      update({ minPrice: min, maxPrice: max });
    }
  }

  // Chips for every picked filter (search stays; it's in the header)
  const chips = [
    ...FILTER_GROUPS.flatMap((g) =>
      g.options
        .filter((o) => searchParams.get(g.param) === o.value)
        .map((o) => ({ key: g.param, label: o.label }))
    ),
    ...TOGGLES.filter((t) => searchParams.get(t.param) === "true").map((t) => ({ key: t.param, label: t.label })),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? [{ key: "price", label: `${query.minPrice !== undefined ? `$${query.minPrice / 100}` : "Any"} – ${query.maxPrice !== undefined ? `$${query.maxPrice / 100}` : "Any"}` }]
      : []),
  ];

  function clearAll() {
    setMinText("");
    setMaxText("");
    const next = new URLSearchParams();
    if (query.q) next.set("q", query.q);
    if (searchParams.get("sort")) next.set("sort", searchParams.get("sort")!);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const sort: SortKey = query.sort ?? (query.q ? "relevance" : "newest");
  const first = total === 0 ? 0 : (page - 1) * query.pageSize + 1;
  const last = Math.min(page * query.pageSize, total);

  const filters = (
    <div className="flex flex-col gap-6">
      {/* Price range, in dollars */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</p>
        <div className="flex items-center gap-2">
          <input
            type="number" inputMode="decimal" min={0} placeholder="Min $"
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            aria-label="Minimum price in dollars"
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          />
          <span className="text-muted-foreground">to</span>
          <input
            type="number" inputMode="decimal" min={0} placeholder="Max $"
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            onBlur={applyPrice}
            onKeyDown={(e) => e.key === "Enter" && applyPrice()}
            aria-label="Maximum price in dollars"
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          />
        </div>
      </div>

      {/* Availability and sale switches */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Availability</p>
        {TOGGLES.map((t) => (
          <label key={t.param} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={searchParams.get(t.param) === "true"}
              onChange={(e) => update({ [t.param]: e.target.checked ? "true" : null })}
            />
            {t.label}
          </label>
        ))}
      </div>

      {/* One row of buttons per group */}
      {FILTER_GROUPS.map((group) => (
        <div key={group.name} className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.name}</p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => {
              const isOn = searchParams.get(group.param) === option.value;
              return (
                <Button
                  key={option.value}
                  size="sm"
                  variant={isOn ? "default" : "outline"}
                  aria-pressed={isOn}
                  onClick={() => choose(group.param, option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
      {chips.length > 0 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={clearAll}>Clear all filters</Button>
      )}
    </div>
  );

  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      {/* Filters on the left on tablets and laptops; a drawer opened by the Filters button on phones */}
      <aside className={`${showFilters ? "block" : "hidden"} rounded-lg border bg-white p-4 md:block md:border-0 md:bg-transparent md:p-0`}>
        {filters}
      </aside>

      <div className={`flex flex-col gap-6 transition-opacity ${pending ? "opacity-60" : ""}`}>
        {/* Top bar. Result count on the left, sort (and the Filters button on phones) on the right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {total === 0 ? "No books" : `Showing ${first}–${last} of ${total} books`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="md:hidden" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal /> Filters{chips.length > 0 ? ` (${chips.length})` : ""}
            </Button>
            <select
              value={sort}
              onChange={(e) => update({ sort: e.target.value })}
              aria-label="Sort books"
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {Object.entries(SORT_OPTIONS)
                .filter(([key]) => key !== "relevance" || query.q)
                .map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
            </select>
          </div>
        </div>

        {/* Chips for each picked filter. Clicking one removes it */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <Button
                key={c.key}
                size="xs"
                variant="secondary"
                onClick={() => {
                  if (c.key === "price") {
                    setMinText("");
                    setMaxText("");
                    update({ minPrice: null, maxPrice: null });
                  } else update({ [c.key]: null });
                }}
              >
                {c.label} <X />
              </Button>
            ))}
          </div>
        )}

        {books.length === 0 ? (
          <div className="rounded-lg border bg-white p-10 text-center">
            <p className="text-lg font-medium">No books match</p>
            <p className="mt-1 text-sm text-muted-foreground">Try removing a filter or searching for something else.</p>
            {chips.length > 0 && <Button className="mt-4" variant="outline" onClick={clearAll}>Clear all filters</Button>}
          </div>
        ) : (
          /* Fits as many 160px+ columns as the screen allows */
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6">
            {books.map((book, i) => (
              <BookCard key={book.bookId} book={book} eager={i < 6} />
            ))}
          </div>
        )}

        {/* Page numbers */}
        {totalPages > 1 && (
          <nav className="flex flex-wrap justify-center gap-2" aria-label="Pages">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                size="sm"
                variant={n === page ? "default" : "outline"}
                aria-current={n === page ? "page" : undefined}
                onClick={() => update({ page: n === 1 ? null : String(n) }, true)}
              >
                {n}
              </Button>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
