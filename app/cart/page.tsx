"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type CartBook = { // formatted for google books api
  id: string;
  title: string;
  author: string;
  price: number;
  quantity: number; // has to be checked to make sure when user adds more books, it doesnt exceed current stock of that book
  bookCover: string;
};

const initalizeBooks: CartBook[] = [
  { id: "example", title: "example", author: "placeholder", price: 10.99, quantity: 1, bookCover: "/exampleCover.png" },
  { id: "example2", title: "example2", author: "placeholder", price: 15.99, quantity: 1, bookCover: "/exampleCover.png" },
  { id: "example3", title: "example3", author: "placeholder", price: 11.99, quantity: 1, bookCover: "/exampleCover.png" },
];

const money = (n: number) => "$" + n.toFixed(2); // small helper function to format pricing

export default function CartPage() {
  const [books, setBooks] = useState<CartBook[]>(initalizeBooks);

  const changeQuantity = (id: string, amount: number) => {
    setBooks((current) => // updates cart
      current.map((cartBook) => // visits every book and changes list if appropriate
        cartBook.id === id
          ? { ...cartBook, quantity: Math.max(1, cartBook.quantity + amount) } // if book was clicked, update quantity. else dont do anything
          : cartBook
      )
    );
  };

  const removeBook = (id: string) => {
    setBooks((current) => current.filter((book) => book.id !== id));
    
    // checks test case and only keeps book if true
  };

 let total: number = 0; // Initialize your starting sum (the initialValue)
  books.forEach((book) => {
  total += book.price * book.quantity;
});

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-3xl rounded-lg border-2 border-foreground p-8 sm:p-10">
        <h1 className="mb-8 text-center text-3xl font-bold">Shopping cart</h1>

        <div className="divide-y">
          {books.length === 0 && (
            <p className="py-10 text-center text-muted-foreground">
              Your cart is empty.
            </p>
          )}

          {books.map((CartBook) => (
            <div
              key={CartBook.id}
              className="flex items-center justify-between gap-6 py-5"
            >
              
              <div className="flex min-w-0 items-center gap-4">
                <img
                  src={CartBook.bookCover}
                  alt={`Cover of ${CartBook.title}`}
                  className="h-24 w-16 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium leading-tight">{CartBook.title}</p>
                  <p className="text-sm text-muted-foreground">{CartBook.author}</p>
                  <p className="text-sm text-muted-foreground">
                    {money(CartBook.price)}
                  </p>
                </div>
              </div>

              
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeQuantity(CartBook.id, -1)}
                    aria-label={`Decrease ${CartBook.title}`}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center">{CartBook.quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeQuantity(CartBook.id, 1)}
                    aria-label={`Increase ${CartBook.title}`}
                  >
                    +
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBook(CartBook.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        
        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <p className="text-lg font-semibold">Total: {money(total)}</p>
          <Button disabled={books.length === 0}>Checkout</Button>
        </div>
      </div>
    </main>
  );
}