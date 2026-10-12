"use client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import React from "react";
import { useRouter } from "next/navigation";
// 1. Genre for book, Will be auto by backend
const categories = [
  "Fiction",
  "Sci-Fi & Fantasy",
  "Mystery & Thriller",
  "Non-Fiction",
];
//Data for for books, Will be auto by backend
const mockBooks = [
  { id: 1, title: "The Silent Forest", author: "Elara Vance", price: "$14.99", rating: "4.8" },
  { id: 2, title: "Echoes of Earth", author: "Marcus Thorne", price: "$18.50", rating: "4.5" },
  { id: 3, title: "Rooted Deep", author: "Sylvia Plume", price: "$16.00", rating: "4.9" },
  { id: 4, title: "Wandering Rivers", author: "Jonathan Creek", price: "$20.00", rating: "4.2" },
  { id: 5, title: "Under the Canopy", author: "Amelia Woods", price: "$15.50", rating: "4.7" },
  { id: 6, title: "Stone and Shadow", author: "David Flint", price: "$22.00", rating: "4.6" },
  { id: 7, title: "Salt & Lantern", author: "Mira Okafor", price: "$17.25", rating: "4.4" },
  { id: 8, title: "The Cartographer's Daughter", author: "Henry Ashdown", price: "$19.00", rating: "4.7" },
  { id: 9, title: "Winter Orchard", author: "Lena Hartwell", price: "$13.99", rating: "4.3" },
  { id: 10, title: "Paper Tides", author: "Idris Calloway", price: "$21.00", rating: "4.8" },
  { id: 11, title: "A Map of Quiet Things", author: "Noor Bhatt", price: "$16.75", rating: "4.5" },
  { id: 12, title: "Hollow Crown", author: "Tobias Reed", price: "$24.00", rating: "4.1" },
];
// 2. Separate Component for each Book Row (With Carousel effect)
function CategoryRow({ category }: { category: string }) {
  //Give response after onClick Event
  const handleAddToCart = (title: string) => {
    alert(`Successfully added "${title}" to your cart!`);
  };
  
  return (
    <section className="relative">
      {/*Genre title*/}
      <h2 className="text-2xl font-bold tracking-tight mb-4 text-center">{category}</h2>
      {/*Carousel options, auto for full scroll*/}
      <Carousel
        opts={{
          align: "start",
          slidesToScroll: "auto", 
        }}
        className="w-full relative"
      >
        {/* */}
        <CarouselContent className="-ml-4">
          {mockBooks.map((book) => (
            <CarouselItem
              key={book.id}
              className="pl-4 min-w-0 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
            >
              <article className="h-full flex flex-col border rounded-lg overflow-hidden relative bg-card hover:shadow-md transition-shadow">
                <div className="relative aspect-[3/4] bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  Image Cover
                </div>

                <div className="p-4 flex flex-col flex-1 space-y-1">
                  <h3 className="font-semibold line-clamp-1" title={book.title}>
                    {book.title}
                  </h3>
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    {book.author}
                  </div>

                  <div className="mt-auto pt-4 flex flex-col">
                    <span className="font-bold">{book.price}</span>
                    <span className="text-sm text-muted-foreground mt-0.5">
                      {book.rating} ★
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleAddToCart(book.title)}
                  className="absolute bottom-3 right-3 h-8 w-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold shadow-sm hover:scale-105 transition-transform"
                  title="Add to Cart"
                >
                  +
                </button>
              </article>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Navigation Arrows (auto-disable at the start/end) */}
        <CarouselPrevious className="-left-4 lg:-left-8 disabled:hidden" />
        <CarouselNext className="-right-4 lg:-right-8 disabled:hidden"/>
      </Carousel>
    </section>
  );
}

// 3. Main Page Component
export default function Home() {
  
  return (
    <main className="pb-12 bg-background">

      {/* Hero stays contained to max-w-7xl */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <section className="relative w-full aspect-[21/9] md:aspect-[3/1] bg-muted rounded-xl overflow-hidden flex items-center border">
          <div className="absolute inset-0 bg-secondary/20"></div>
          <div className="relative z-10 p-8 md:p-12 max-w-lg space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Autumn Reading Sale
            </h2>
            <p className="text-lg text-muted-foreground">
              Cozy up with 20% off all fiction. Use code: AUTUMN20
            </p>
            <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90 transition-colors">
              Shop Collection
            </button>
          </div>
        </section>
      </div>

      {/* Book rows: 90% width () so items sit closer to the edges */}
      <div className="w-[95%] mx-auto mt-12 space-y-10">
        {categories.map((category) => (
          <CategoryRow key={category} category={category} />
        ))}
      </div>


    </main>
  );
}


