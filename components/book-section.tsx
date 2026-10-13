"use client"; // Needs to run in the browser since it uses useState and onClick

import { useState } from "react";
import { BookCard, type Book } from "@/components/book-card";
import { Button } from "@/components/ui/button";

// Decides whether the book at position i should show on each screen size.
// Phones fit 2 per row, tablets 4, laptops 6, so 1 row is a different
// number of books depending on the screen.
function visibilityClass(i: number, rows: number) {
  if (i < rows * 2) return "";                  // Fits on every screen
  if (i < rows * 4) return "hidden md:block";   // Tablet and up only
  return "hidden lg:block";                     // Laptop only
}

// Same idea for the See more button. Hides it on screen sizes that are already showing every book
// so phone users don't get stuck when laptops have run out
function seeMoreClass(rows: number, total: number) {
  if (rows * 6 < total) return "";            // More left on every screen
  if (rows * 4 < total) return "lg:hidden";   // Laptops have shown everything
  return "md:hidden";                         // Only phones still have more
}

// One catalog section. Consists of a heading and a grid of books
// w/ buttons to show more or fewer rows.
// eager = only pass this to the top section so its first row of covers loads right away
export function BookSection({ title, books, eager = false }: { title: string; books: Book[]; eager?: boolean }) {
    // Sets how many rows are showing
    const [rows, setRows] = useState(1); // Starts with one row to avoid cluttering the page
    const [setVisibleCount] = useState(6);

    return (
    <section>
        <h1 className="text-2xl font-bold underline text-center mb-12">{title}</h1>
        {/* 2 columns on phones, 4 on tablets, 6 on laptops */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {/* Render enough books for the widest screen, then hide extras on smaller ones */}
            {books.slice(0, rows * 6).map((book, i) => (
                <div key={book.isbn13} className={visibilityClass(i, rows)}>
                    {/* Only the first row of the top section loads its covers right away */}
                    <BookCard book={book} eager={eager && i < 6} />
                </div>
            ))}
        </div>
        <div className="mt-12 flex justify-center gap-3">
            {/* Adds one row per click. Disappears once every book in the section is showing */}
            {rows * 2 < books.length && (
                <Button className={seeMoreClass(rows, books.length)} onClick={() => setRows(rows + 1)}>
                See more
                </Button>
            )}
            {/* Only show See less once the section has been expanded. Goes back to one row */}
            {rows > 1 && (
                <Button variant="outline" onClick={() => setRows(1)}>See less</Button>
            )}
        </div>
        <hr className="mt-12 mb-4"></hr>
    </section>
    );
}