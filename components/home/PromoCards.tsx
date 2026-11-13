// Two promo cards under the banner. The titles are part of the images (public/images).
import Image from 'next/image';
import Link from 'next/link';

const CARDS = [
  {
    href: '/product-catalog/all?section=special-edition',
    src: '/images/gift_guide_promo_card.webp',
    alt: 'Gift Guide',
    line: 'Exclusive editions that make great gifts',
  },
  {
    href: '/product-catalog/all?sort=rating-desc&minRating=4.5',
    src: '/images/staff_picks_promo_card.webp',
    alt: 'Staff Picks',
    line: 'Our highest-rated reads, 4.5 stars and up',
  },
];

export function PromoCards() {
  return (
    <section aria-label="Featured collections" className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-6">
      {CARDS.map((c) => (
        <Link key={c.href} href={c.href} className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs transition hover:shadow-md">
          <Image src={c.src} alt={c.alt} width={1200} height={800} sizes="(min-width: 896px) 440px, 50vw" className="h-auto w-full transition group-hover:scale-[1.01]" />
          <p className="flex items-center justify-between gap-2 border-t border-stone-100 px-3 py-2 text-xs text-stone-700 sm:px-5 sm:py-3 sm:text-sm">
            <span className="hidden sm:inline">{c.line}</span>
            <span className="font-semibold text-stone-900 group-hover:underline">Shop {c.alt} &rarr;</span>
          </p>
        </Link>
      ))}
    </section>
  );
}
