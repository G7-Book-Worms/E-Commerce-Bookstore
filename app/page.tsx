"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Lock, ShoppingCart, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type Format = "hardcover" | "paperback";

const book = {
  id: "2",
  title: "A book",
  author: "An Author",
  image: "/components/GHeS_cybcAAo5bn.png",
  rating: 4,
  reviewCount: 532,
  summary:
    "A summary",
  onSale: true,
  salePercent: 25,
  formats: {
    hardcover: { price: 30.0, inStock: true },
    paperback: { price: 18.0, inStock: true },
  } as Record<Format, { price: number; inStock: boolean }>,
};

const LABELS: Record<Format, string> = {
  hardcover: "Hardcover",
  paperback: "Paperback",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function Home() {
  const formats = Object.keys(book.formats) as Format[];

  const [selected, setSelected] = useState<Format | null>(
    formats.find((f) => book.formats[f].inStock) ?? null
  );
  const [added, setAdded] = useState(false);

  const basePrice = selected ? book.formats[selected].price : null;
  const finalPrice =
    basePrice === null
      ? null
      : book.onSale
        ? Math.round(basePrice * (1 - book.salePercent / 100) * 100) / 100
        : basePrice;

  function handleAddToCart() {
    if (!selected) return;
    console.log("Add to cart:", { bookId: book.id, format: selected });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <main className="mx-auto flex w-fit gap-10 p-12">
      <div className="relative h-[480px] w-80 shrink-0 overflow-hidden rounded-xl border bg-muted">
        <Image
          src={book.image}
          alt={`Cover of ${book.title}`}
          fill
          priority
          className="object-cover"
          sizes="320px"
        />
      </div>

      <div className="flex w-[28rem] shrink-0 flex-col items-start gap-6">
        <div className="flex flex-col gap-2">
          {book.onSale && (
            <Badge variant="destructive" className="w-fit">
              {book.salePercent}% off
            </Badge>
          )}

          <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
          <p className="text-muted-foreground">by {book.author}</p>

          <div className="flex items-center gap-2" aria-label={`Rated ${book.rating} out of 5`}>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={
                    n <= Math.round(book.rating)
                      ? "size-5 fill-yellow-400 text-yellow-400"
                      : "size-5 text-muted-foreground"
                  }
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              {book.rating} ({book.reviewCount.toLocaleString()} reviews)
            </span>
          </div>
        </div>

        <div className="flex items-baseline gap-3">
          {finalPrice !== null ? (
            <>
              <span className="text-3xl font-bold">{money(finalPrice)}</span>
              {book.onSale && basePrice !== null && (
                <span className="text-lg text-muted-foreground line-through">
                  {money(basePrice)}
                </span>
              )}
            </>
          ) : (
            <span className="text-lg text-muted-foreground">Currently unavailable</span>
          )}
        </div>

        <div role="radiogroup" aria-label="Book format" className="flex gap-3">
          {formats.map((format) => {
            const available = book.formats[format].inStock;
            const isSelected = selected === format;

            return (
              <Button
                key={format}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={!available}
                variant={isSelected ? "default" : "outline"}
                onClick={() => setSelected(format)}
                className={
                  available
                    ? ""
                    : "cursor-not-allowed bg-muted text-muted-foreground line-through opacity-60"
                }
              >
                {!available && <Lock />}
                {LABELS[format]}
                {!available && <span className="text-xs">(sold out)</span>}
              </Button>
            );
          })}
        </div>

        <Button size="lg" disabled={!selected} onClick={handleAddToCart}>
          {added ? <Check /> : <ShoppingCart />}
          {added ? "Added to cart" : "Add to cart"}
        </Button>

        <Accordion defaultValue={["summary"]}>
          <AccordionItem value="summary">
            <AccordionTrigger>Summary</AccordionTrigger>
            <AccordionContent>{book.summary}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </main>
  );
}