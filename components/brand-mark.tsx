// The Book Worms logo mark: Worm's head and book (public/brand/worm-mark.png). Decorative next to
// the "Book Worms" wordmark, so it has empty alt text. The full reading Worm is
// public/brand/worm-reading.png; the favicon is app/icon.png.
import Image from 'next/image';

export function BrandMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return <Image src="/brand/worm-mark.png" alt="" width={size} height={size} className={className} priority />;
}
