"use client";

// Product page body (Notion Product Page epic). Started from Paul's product page design:
// cover on the left; title, rating, price, format buttons, Add to Cart and summary on the right.

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, Minus, Plus, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookCover } from "@/components/book-cover";
import { CartStepper } from "@/components/book-card";
import { StarRating } from "@/components/star-rating";
import { useCart } from "@/app/context/CartContext";
import { FORMATS, effectivePrice, formatPrice, stockLabel, type CatalogBook, type Format } from "@/lib/catalog";

const LABELS: Record<Format, string> = { hardcover: "Hardcover", paperback: "Paperback" };

export function ProductView({ book }: { book: CatalogBook }) {
  const { addToCart, quantityOf } = useCart();

  // Every format is shown; ones the book isn't sold in, or that are sold out, are locked
  const byFormat = Object.fromEntries(book.formats.map((f) => [f.format, f])) as Partial<Record<Format, CatalogBook["formats"][number]>>;
  const firstAvailable = FORMATS.filter((f) => (byFormat[f]?.stock ?? 0) > 0)
    .sort((a, b) => effectivePrice(byFormat[a]!) - effectivePrice(byFormat[b]!))[0];

  const [selected, setSelected] = useState<Format | null>(firstAvailable ?? null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<{ kind: "added" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const current = selected ? byFormat[selected] : undefined;
  // Copies of the selected edition already in the cart, for the stepper below Add to Cart
  const inCartNow = selected ? quantityOf(book.bookId, selected) : 0;
  const stock = current?.stock ?? 0;
  const salePercent = current?.salePriceCents != null
    ? Math.round((1 - current.salePriceCents / current.priceCents) * 100)
    : 0;

  function choose(format: Format) {
    setSelected(format);
    setQuantity(1);
    setStatus(null);
  }

  async function handleAddToCart() {
    if (!selected || !current) return;
    // Guests add to the cart in this browser and can check out without an account (SCRUM-208);
    // addToCart handles both cases.
    setBusy(true);
    const error = await addToCart(book.bookId, selected, quantity);
    setBusy(false);
    setStatus(error
      ? { kind: "error", text: error }
      : { kind: "added", text: `Added ${quantity} ${LABELS[selected].toLowerCase()} cop${quantity === 1 ? "y" : "ies"} to your cart` });
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-12">
      <div className="relative mx-auto aspect-2/3 w-full max-w-60 md:max-w-80 overflow-hidden rounded-xl border bg-muted shadow-sm">
        <BookCover title={book.title} author={book.author} isbn={book.isbn} coverImageUrl={book.coverImageUrl} eager sizes="320px" />
      </div>

      <div className="flex min-w-0 flex-col items-start gap-6">
        <div className="flex flex-col gap-2">
          {book.onSale && current?.salePriceCents != null && (
            <Badge variant="destructive" className="w-fit">Sale · {salePercent}% off</Badge>
          )}
          <h1 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">{book.title}</h1>
          <p className="text-muted-foreground">by <span className="text-foreground">{book.author}</span></p>
          <StarRating value={book.ratingAvg} count={book.ratingCount} size={18} />
        </div>

        <div className="flex items-baseline gap-3">
          {current ? (
            <>
              <span className={`text-3xl font-bold ${current.salePriceCents != null ? "text-red-700" : ""}`}>
                {formatPrice(effectivePrice(current))}
              </span>
              {current.salePriceCents != null && (
                <span className="text-lg text-muted-foreground line-through">{formatPrice(current.priceCents)}</span>
              )}
            </>
          ) : (
            <span className="text-lg text-muted-foreground">Currently unavailable</span>
          )}
        </div>

        {/* Format buttons, each with its own price. Locked = not sold in that format, or sold out */}
        <div role="radiogroup" aria-label="Book format" className="flex flex-wrap gap-3">
          {FORMATS.map((format) => {
            const f = byFormat[format];
            const available = (f?.stock ?? 0) > 0;
            const isSelected = selected === format;
            return (
              <button
                key={format}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!available}
                onClick={() => choose(format)}
                className={`flex min-w-36 flex-col items-start rounded-lg border px-4 py-2 text-left transition ${
                  isSelected ? "border-stone-900 bg-stone-900 text-white" : "bg-white hover:border-stone-400"
                } ${available ? "" : "cursor-not-allowed bg-stone-100 text-stone-400"}`}
              >
                <span className="flex items-center gap-1 text-sm font-semibold">
                  {!available && <Lock size={14} />}
                  {LABELS[format]}
                </span>
                <span className="text-xs">
                  {!f ? "Not available" : !available ? "Sold out" : formatPrice(effectivePrice(f))}
                </span>
              </button>
            );
          })}
        </div>

        {current && (
          <p className={`text-sm ${stock <= 0 ? "text-red-700" : stock <= 3 ? "text-amber-700" : "text-emerald-700"}`}>
            {stockLabel(stock)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {/* Quantity: 1 up to what's in stock for this format */}
          <div className="flex items-center rounded-md border bg-white" aria-label="Quantity">
            <Button variant="ghost" size="icon" aria-label="Fewer" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}>
              <Minus />
            </Button>
            <span className="w-8 text-center tabular-nums" aria-live="polite">{quantity}</span>
            <Button variant="ghost" size="icon" aria-label="More" disabled={!current || quantity >= stock} onClick={() => setQuantity(quantity + 1)}>
              <Plus />
            </Button>
          </div>
          <Button size="lg" disabled={!current || stock <= 0 || busy} onClick={handleAddToCart}>
            {status?.kind === "added" ? <Check /> : <ShoppingCart />}
            {busy ? "Adding…" : inCartNow > 0 ? "Add more" : "Add to Cart"}
          </Button>
        </div>

        {/* Already in the cart in this edition: change how many copies without going to the cart */}
        {selected && inCartNow > 0 && (
          <div className="w-full max-w-72">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">In your cart</p>
            <CartStepper
              bookId={book.bookId}
              format={selected}
              quantity={inCartNow}
              max={stock}
              title={`${book.title} (${LABELS[selected].toLowerCase()})`}
            />
          </div>
        )}
        {status && (
          <p role="status" className={`text-sm ${status.kind === "error" ? "text-red-700" : "text-emerald-700"}`}>
            {status.text}
            {status.kind === "added" && (
              <> · <Link href="/cart" className="font-medium underline">View cart</Link></>
            )}
          </p>
        )}

        <Accordion defaultValue={["summary"]} className="w-full">
          <AccordionItem value="summary">
            <AccordionTrigger>Summary</AccordionTrigger>
            <AccordionContent>{book.description || "No summary yet."}</AccordionContent>
          </AccordionItem>
          <AccordionItem value="details">
            <AccordionTrigger>Product details</AccordionTrigger>
            <AccordionContent>
              <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-sm">
                <dt className="text-muted-foreground">ISBN</dt><dd>{book.isbn}</dd>
                {book.category && (<><dt className="text-muted-foreground">Genre</dt><dd>{book.category.name}</dd></>)}
                <dt className="text-muted-foreground">Formats</dt><dd>{book.formats.map((f) => LABELS[f.format]).join(", ") || "—"}</dd>
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
