// app/(main)/page.tsx
import { Suspense } from 'react';
import { connection } from 'next/server';
import { BooksService } from '../../server/src/modules/books/books-service';
import { HeroBanner } from '@/components/home/HeroBanner';
import { GenreCarousel } from '@/components/home/GenreCarousel';

async function HomepageContent() {
  // Books and promotions come from the database, so render at request time
  await connection();
  const booksService = new BooksService();
  const feed = await booksService.getHomepageFeed();

  const promotion = feed?.promotion ?? {
    headline: 'Welcome to Book Worms',
    code: 'READMORE10',
    startDate: null,
    endDate: null,
  };

  const carousels = feed?.carousels ?? [];

  return (
    <>
      {/* SCRUM-116: Promotional Hero */}
      <HeroBanner promotion={promotion} />

      {/* SCRUM-117: Genre Carousels */}
      {carousels.map((carousel) => (
        <GenreCarousel
          key={carousel.categoryId}
          categoryName={carousel.categoryName}
          categorySlug={carousel.categorySlug}
          books={carousel.books}
        />
      ))}
    </>
  );
}

function HomepageSkeleton() {
  return (
    <div className="space-y-12 animate-pulse">
      <div className="h-64 bg-stone-200 rounded-2xl" />
      <div className="space-y-4">
        <div className="h-6 w-48 bg-stone-200 rounded" />
        <div className="flex gap-4">
          <div className="h-72 w-52 bg-stone-200 rounded-xl" />
          <div className="h-72 w-52 bg-stone-200 rounded-xl" />
          <div className="h-72 w-52 bg-stone-200 rounded-xl" />
          <div className="h-72 w-52 bg-stone-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={<HomepageSkeleton />}>
        <HomepageContent />
      </Suspense>
    </div>
  );
}