// Friendly empty / error states with one of the sad-animal photos (public/images/empty-states).
import Image from 'next/image';
import type { ReactNode } from 'react';

export const EMPTY_IMAGES = {
  cart: 'dachshund-puppy-lying-down',
  search: 'tabby-kitten-looking-up',
  orders: 'jack-russell-puppy-head-tilt',
  notFound: 'french-bulldog-puppy-frowning',
  error: 'dark-kitten-blue-eyes',
  signIn: 'black-puppy-staring',
} as const;

export function EmptyState({ image, title, children }: { image: keyof typeof EMPTY_IMAGES; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-stone-200 bg-white px-6 py-10 text-center">
      <Image src={`/images/empty-states/${EMPTY_IMAGES[image]}.webp`} alt="" width={240} height={180} className="mb-4 h-36 w-auto sm:h-44" />
      <p className="font-serif text-xl font-bold text-stone-900">{title}</p>
      {children && <div className="mt-2 text-sm text-stone-600">{children}</div>}
    </div>
  );
}
