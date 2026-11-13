// components/home/HeroBanner.tsx
// Seasonal sale banner (image from public/images) + a strip advertising the current discount code.
import Image from 'next/image';
import Link from 'next/link';

export interface HeroBannerProps {
  code?: string | null; // e.g. BOOKWORMS10
  label?: string | null; // e.g. "10% off"
}

export function HeroBanner({ code, label }: HeroBannerProps) {
  return (
    <section aria-label="Autumn sale" className="overflow-hidden rounded-2xl border border-stone-200 bg-[#efe8dc] shadow-xs">
      <Link href="/product-catalog/all?onSale=true" className="block">
        {/* 2400x900 banner; the words "Autumn Sale" are part of the image */}
        <Image
          src="/images/autumn_sale_banner.webp"
          alt="Autumn Sale: books on sale now"
          width={2400}
          height={900}
          priority
          sizes="(min-width: 1280px) 1216px, 100vw"
          className="h-auto w-full"
        />
      </Link>
      <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-200 bg-white px-5 py-4 text-center sm:flex-row sm:text-left">
        <p className="text-sm text-stone-700">
          Sale prices on bestsellers and paperbacks
          {code && (
            <>
              {' '}· Take an extra <b>{label}</b> at checkout with code{' '}
              <code className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono font-semibold text-stone-900">{code}</code>
            </>
          )}
        </p>
        <Link
          href="/product-catalog/all?onSale=true"
          className="inline-flex h-9 shrink-0 items-center rounded-full bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-800"
        >
          Shop the sale &rarr;
        </Link>
      </div>
    </section>
  );
}
