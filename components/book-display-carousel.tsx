import * as React from "react"
import Image from "next/image"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// Define what a Book looks like in TypeScript
export interface Book {
  id: string
  title: string
  author: string
  price: number
  coverUrl: string
  tag?: string // e.g., "Bestseller" or "New"
}

interface BookDisplayCarouselProps {
  title?: string
  books: Book[]
}

export function BookDisplayCarousel({ title = "Featured Books", books }: BookDisplayCarouselProps) {
  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-12">
      <h2 className="text-2xl font-bold tracking-tight mb-6">{title}</h2>
      
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {books.map((book) => (
            <CarouselItem key={book.id} className="pl-4 md:basis-1/3 lg:basis-1/4">
              <div className="p-1">
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-0 relative aspect-[2/3]">
                    {/* Optional Badge for "Bestseller" or "New" */}
                    {book.tag && (
                      <Badge className="absolute top-2 left-2 z-10">
                        {book.tag}
                      </Badge>
                    )}
                    
                    {/* Fallback gray background in case image URL is empty */}
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center relative">
                       {/* Ensure you add your image domains to next.config.mjs if using external URLs */}
                      <Image
                        src={book.coverUrl || "/placeholder-book.jpg"}
                        alt={`Cover of ${book.title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col items-start p-4 bg-white">
                    <h3 className="font-semibold text-lg line-clamp-1">{book.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{book.author}</p>
                    <div className="w-full flex items-center justify-between mt-2">
                      <span className="font-bold">${book.price.toFixed(2)}</span>
                      <Button size="sm">Add to Cart</Button>
                    </div>
                  </CardFooter>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}