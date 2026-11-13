// app/(main)/page.tsx
// Homepage: seasonal sale banner, promo cards, then book rows (all from the database).
import { Suspense } from 'react';
import { connection } from 'next/server';
import { HeroBanner } from '@/components/home/HeroBanner';
import { PromoCards } from '@/components/home/PromoCards';
import { GenreTiles } from '@/components/home/GenreTiles';
import { BookSection } from '@/components/book-section';
import { catalogRows } from '@/server/src/modules/books/catalog-repository';
import { findFeaturedDiscount } from '@/server/src/modules/discounts/discounts-repository';
import { describeDiscount } from '@/server/src/modules/cart/pricing';


async function Banner() {
  await connection();
  const code = await findFeaturedDiscount();
  return <HeroBanner code={code?.code} label={code ? describeDiscount(code) : null} />;
}

// Some of the catalog rows, in the given order (the full set is on /product-catalog)
async function Rows({ keys }: { keys: string[] }) {
  // Books come from the database, so render at request time
  await connection();
  const rows = (await catalogRows(12)).filter((r) => keys.includes(r.key));
  rows.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  return (
    <>
      {rows.map((row) => (
        <BookSection key={row.key} title={row.label} books={row.books} total={row.total} href={`/product-catalog/all?${row.param}`} />
      ))}
    </>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-7 w-48 bg-stone-200 rounded" />
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-80 w-44 shrink-0 bg-stone-200 rounded-lg" />)}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-10">
      <Suspense fallback={<div className="aspect-[8/3] rounded-2xl bg-stone-200 animate-pulse" />}>
        <Banner />
      </Suspense>
      <PromoCards />
      <Suspense fallback={<RowsSkeleton />}>
        <Rows keys={['bestseller', 'new-release']} />
      </Suspense>
      <GenreTiles />
      <Suspense fallback={<RowsSkeleton />}>
        <Rows keys={['on-sale', 'fiction', 'nonfiction']} />
      </Suspense>
    </div>
  );
}
