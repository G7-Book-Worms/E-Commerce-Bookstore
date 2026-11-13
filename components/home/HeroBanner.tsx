// components/home/HeroBanner.tsx
import React from 'react';
import Link from 'next/link';

export interface HeroBannerProps {
  promotion?: {
    headline: string;
    code?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ promotion }) => {
  if (!promotion) return null;

  return (
    <section className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-900 text-stone-50 shadow-sm p-8 sm:p-12 mb-10">
      <div className="max-w-2xl space-y-4">
        {/* Shadcn Badge */}
        <div className="inline-flex items-center rounded-full border border-stone-700 bg-stone-800 px-2.5 py-0.5 text-xs font-semibold text-stone-200">
          Featured Event
        </div>

        <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white">
          {promotion.headline}
        </h1>

        <p className="text-stone-300 text-sm leading-relaxed max-w-lg">
          Immerse yourself in new worlds, timeless literary fiction, and bestsellers curated by our bookstore archivists.
        </p>

        {promotion.code && (
          <div className="flex items-center gap-2 pt-1 text-xs text-stone-400">
            <span>Use coupon code:</span>
            <code className="relative rounded bg-stone-800 px-[0.4rem] py-[0.2rem] font-mono font-semibold text-stone-200 border border-stone-700">
              {promotion.code}
            </code>
          </div>
        )}

        <div className="pt-2">
          {/* Shadcn Button Variant Primary */}
          <Link
            href="/books"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-white text-stone-900 shadow-xs hover:bg-stone-100 h-9 px-4 py-2 transition"
          >
            Shop Collection &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
};