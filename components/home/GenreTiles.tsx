// "Shop by genre" tiles. The genre names are part of the images (public/images/*_genre_tile).
import Image from 'next/image';
import Link from 'next/link';

const GENRES = [
  { slug: 'fiction', label: 'Fiction', src: '/images/fiction_genre_tile.webp' },
  { slug: 'nonfiction', label: 'Nonfiction', src: '/images/non-fiction_genre_tile.webp' },
  { slug: 'fantasy', label: 'Fantasy', src: '/images/fantasy_genre_tile.webp' },
  { slug: 'history', label: 'History', src: '/images/history_genre_tile.webp' },
];

export function GenreTiles() {
  return (
    <section aria-labelledby="shop-by-genre">
      <div className="mb-4 flex items-end justify-between gap-4 border-b pb-2">
        <h2 id="shop-by-genre" className="font-serif text-2xl font-bold">Shop by Genre</h2>
        <Link href="/product-catalog" className="text-sm font-medium hover:underline">All books &rarr;</Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-6">
        {GENRES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/product-catalog/all?genre=${g.slug}`}
              className="block overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xs transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <Image src={g.src} alt={`Shop ${g.label}`} width={800} height={800} sizes="(min-width: 640px) 25vw, 50vw" className="h-auto w-full" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
