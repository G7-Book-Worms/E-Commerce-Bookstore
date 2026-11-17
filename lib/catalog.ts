// Shared catalog types + helpers (used by server code and client components).

export const FORMATS = ["hardcover", "paperback"] as const;
export type Format = (typeof FORMATS)[number];

export type CatalogFormat = {
  format: Format;
  priceCents: number;
  salePriceCents: number | null; // null = not on sale
  stock: number;
};

// One book as the catalog, search and product pages see it
export type CatalogBook = {
  bookId: number;
  isbn: string;
  title: string;
  author: string;
  description?: string;
  category?: { name: string; slug: string } | null;
  coverImageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  tags: string[];
  formats: CatalogFormat[];
  fromPriceCents: number; // Cheapest price a shopper can pay right now (sale price counts)
  regularPriceCents: number; // Regular price of that same format, to show struck through on sale
  onSale: boolean;
  totalStock: number;
};

// Catalog sections in the order the catalog page shows them (B&N collections page)
export const SECTIONS = [
  { key: "bestseller", label: "Bestsellers", param: "section=bestseller" },
  { key: "new-release", label: "New Releases", param: "section=new-release" },
  { key: "coming-soon", label: "Coming Soon", param: "section=coming-soon" },
  { key: "special-edition", label: "Book Worms Exclusives", param: "section=special-edition" },
  { key: "trending", label: "Trending Now", param: "section=trending" },
  { key: "paperback-pick", label: "Paperback Picks", param: "section=paperback-pick" },
  { key: "on-sale", label: "On Sale", param: "onSale=true" },
  { key: "fiction", label: "Fiction", param: "genre=fiction" },
  { key: "nonfiction", label: "Nonfiction", param: "genre=nonfiction" },
] as const;

export const SORT_OPTIONS = {
  relevance: "Relevance",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "availability-desc": "Availability: Most in Stock",
  "availability-asc": "Availability: Least in Stock",
  "rating-desc": "Top Rated",
  title: "Title A–Z",
  newest: "Newest",
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function effectivePrice(f: CatalogFormat) {
  return f.salePriceCents ?? f.priceCents;
}

/**
 * The edition the cart takes when the shopper hasn't picked one (the Add to Cart button on a
 * book tile): the cheapest one in stock, sale price counting. This is the same rule the server
 * applies to a line with no format (resolveFormat in guest-cart.ts, and the signed-in cart), so
 * a guest's line gets the edition a signed-in shopper's would. Null when every edition is sold out.
 */
export function defaultCartFormat(book: Pick<CatalogBook, "formats">): Format | null {
  const inStock = book.formats.filter((f) => f.stock > 0);
  if (inStock.length === 0) return null;
  return [...inStock].sort((a, b) => effectivePrice(a) - effectivePrice(b))[0].format;
}

// "12 in stock" / "Only 3 left" / "Out of stock"
export function stockLabel(stock: number) {
  if (stock <= 0) return "Out of stock";
  if (stock <= 3) return `Only ${stock} left`;
  return `${stock} in stock`;
}

// Fills in the price fields from a book's formats
export function withPricing(
  book: Omit<CatalogBook, "fromPriceCents" | "regularPriceCents" | "onSale" | "totalStock">
): CatalogBook {
  const totalStock = book.formats.reduce((n, f) => n + f.stock, 0);
  const inStock = book.formats.filter((f) => f.stock > 0);
  const pool = inStock.length > 0 ? inStock : book.formats;
  const cheapest = [...pool].sort((a, b) => effectivePrice(a) - effectivePrice(b))[0];
  return {
    ...book,
    fromPriceCents: cheapest ? effectivePrice(cheapest) : 0,
    regularPriceCents: cheapest ? cheapest.priceCents : 0,
    onSale: book.formats.some((f) => f.salePriceCents !== null),
    totalStock,
  };
}
