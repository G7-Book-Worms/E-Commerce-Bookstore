"use client"; // Needs to run in the browser since the filters use useState and onClick

// Filters, sorting and the book grid for the See All page.
// Everything is in one component since the filter menu and the grid both need to know what's selected

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { BookCard, type Book } from "@/components/book-card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Each group is single choice so conflicting filters can't be picked together.
// Picking Paperback replaces Hardcover instead of adding to it.
// To add a filter, add a line here. The tag has to match one in lib/sample-books.ts
const FILTER_GROUPS = [
  {
    name: "Genre",
    options: [
      { tag: "fiction", label: "Fiction" },
      { tag: "nonfiction", label: "Nonfiction" },
      { tag: "kids", label: "Kids" },
    ],
  },
  {
    name: "Format",
    options: [
      { tag: "hardcover", label: "Hardcover" },
      { tag: "paperback", label: "Paperback" },
      { tag: "exclusive", label: "B&N Exclusive" },
      { tag: "signed", label: "Signed" },
    ],
  },
  {
    name: "Collection",
    options: [
      { tag: "bestseller", label: "Bestsellers" },
      { tag: "trending", label: "Trending" },
      { tag: "new-release", label: "New Releases" },
      { tag: "coming-soon", label: "Coming Soon" },
    ],
  },
];

// One picked tag per group name. Looks like { Genre: "fiction", Format: "paperback" }
type Selection = Record<string, string | undefined>;

type PriceRange = { min: number | null; max: number | null }; // null = no limit

// Checks if a book fits the price range and every picked filter
function matches(book: Book, selection: Selection, price: PriceRange) {
  if (price.min !== null && book.price < price.min) return false;
  if (price.max !== null && book.price > price.max) return false;
  return Object.values(selection).every((tag) => !tag || book.tags?.includes(tag));
}

// Options in the sort dropdown. compare tells .sort() which of two books goes first
const SORTS = {
  featured: { label: "Featured", compare: () => 0 }, // Keeps the original order
  "price-asc": { label: "Price: Low to High", compare: (a: Book, b: Book) => a.price - b.price },
  "price-desc": { label: "Price: High to Low", compare: (a: Book, b: Book) => b.price - a.price },
};
type SortKey = keyof typeof SORTS;

// Turns what's typed in the price box into a number.
// Empty or invalid = no limit
function toPrice(value: string) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function BookBrowser({ books }: { books: Book[] }) {
  const [selection, setSelection] = useState<Selection>({}); // Starts w/ nothing picked so every book shows
  // Price boxes are kept as text so they can be empty while typing
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [sort, setSort] = useState<SortKey>("featured");

  const price: PriceRange = { min: toPrice(minText), max: toPrice(maxText) };
  // Shown as hints in the empty price boxes
  const cheapest = Math.min(...books.map((b) => b.price));
  const priciest = Math.max(...books.map((b) => b.price));

  // Swaps min and max if min ends up higher.
  // Runs when you click out of either box
  function fixPriceOrder() {
    if (price.min !== null && price.max !== null && price.min > price.max) {
      setMinText(String(price.max));
      setMaxText(String(price.min));
    }
  }

  // Resets every filter and the price range. Sorting stays as is
  function clearAll() {
    setSelection({});
    setMinText("");
    setMaxText("");
  }

  function choose(group: string, tag: string) {
    // Clicking the picked option turns it off. Clicking another one in the same group replaces it
    setSelection({ ...selection, [group]: selection[group] === tag ? undefined : tag });
  }

  // Counts how many books you'd get if this option was picked w/ the other filters kept
  function countIf(group: string, tag: string) {
    return books.filter((b) => matches(b, { ...selection, [group]: tag }, price)).length;
  }

  // List of picked filters w/ their labels. Used for the chips under the Filters button
  const active = FILTER_GROUPS.flatMap((g) =>
    g.options.filter((o) => selection[g.name] === o.tag).map((o) => ({ group: g.name, ...o }))
  );
  const priceActive = price.min !== null || price.max !== null;
  // Number shown on the Filters button. Price range counts as one
  const filterCount = active.length + (priceActive ? 1 : 0);
  // Books that make it through the filters, in the picked sort order
  const visible = books
    .filter((b) => matches(b, selection, price))
    .sort(SORTS[sort].compare);

  return (
    <div className="flex flex-col gap-6">
      {/* Top bar. Result count on the left, sort and filters on the right */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Showing {visible.length} of {books.length} books
        </span>

        <div className="flex items-center gap-2">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort books"
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Filter menu pops out from the Filters button, lined up w/ the right edge of the grid */}
        <Popover>
          <PopoverTrigger render={<Button variant="outline" />}> {/* render makes the trigger look like our Button */}
            <SlidersHorizontal />
            Filters
            {filterCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {filterCount}
              </span>
            )}
          </PopoverTrigger>

          <PopoverContent align="end" className="w-80">
            {/* Price range */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={`Min $${cheapest}`}
                  value={minText}
                  onChange={(e) => setMinText(e.target.value)}
                  onBlur={fixPriceOrder}
                  aria-label="Minimum price"
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={`Max $${priciest}`}
                  value={maxText}
                  onChange={(e) => setMaxText(e.target.value)}
                  onBlur={fixPriceOrder}
                  aria-label="Maximum price"
                  className="h-8 w-full rounded-md border bg-background px-2 text-sm"
                />
              </div>
            </div>
            {/* TODO: wire up once the DB tracks inventory (stock count per book).
                Until then these buttons are disabled and don't filter anything */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Availability <span className="normal-case tracking-normal">(coming soon)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {["In Stock", "Pre-order"].map((label) => (
                  <Button key={label} size="sm" variant="outline" disabled title="Available once inventory is connected">
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {/* One row of buttons per group. Each shows how many books you'd get if you picked it */}
            {FILTER_GROUPS.map((group) => (
              <div key={group.name} className="flex flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option) => {
                    const isOn = selection[group.name] === option.tag;
                    const count = countIf(group.name, option.tag);
                    return (
                      <Button
                        key={option.tag}
                        size="sm"
                        variant={isOn ? "default" : "outline"}
                        disabled={!isOn && count === 0} // Greys out options that show nothing or are incompatible with the current filters
                        onClick={() => choose(group.name, option.tag)}
                      >
                        {option.label}
                        <span className="text-xs opacity-60">{count}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filterCount > 0 && (
              <Button variant="ghost" size="sm" className="self-end" onClick={clearAll}>
                Clear all
              </Button>
            )}
          </PopoverContent>
        </Popover>
        </div>
      </div>

      {/* Chips for each picked filter. Clicking one removes it */}
      {filterCount > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {priceActive && (
            <Button size="xs" variant="secondary" onClick={() => { setMinText(""); setMaxText(""); }}>
              {price.min !== null ? `$${price.min}` : "Any"} – {price.max !== null ? `$${price.max}` : "Any"}
              <X />
            </Button>
          )}
          {active.map((f) => (
            <Button key={f.tag} size="xs" variant="secondary" onClick={() => choose(f.group, f.tag)}>
              {f.label}
              <X />
            </Button>
          ))}
        </div>
      )}

      {/* Fits as many 160px+ columns as the screen allows */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-6">
        {visible.map((book) => (
          <BookCard key={book.isbn13} book={book} />
        ))}
      </div>
    </div>
  );
}
