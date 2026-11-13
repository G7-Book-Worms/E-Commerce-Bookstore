// app/(auth)/layout.tsx
// Sign in / create account: a bookshelf photo on the left (laptops), the form card on the right.
import '../globals.css';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AuthProvider } from '../context/auth-context';

export const metadata = {
  title: 'Sign In | Book Worms',
  description: 'Sign in to your Book Worms account.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <AuthProvider>
          <div className="grid min-h-screen lg:grid-cols-2">
            {/* Side panel image (public/images, 1200x1600). Hidden on phones and tablets */}
            <div className="relative hidden lg:block">
              <Image
                src="/images/sign-in_create-account_side_panel.webp"
                alt=""
                fill
                priority
                sizes="50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/10 to-transparent" />
              <p className="absolute bottom-10 left-10 right-10 font-serif text-3xl font-bold leading-snug text-white">
                Find something worth staying up for.
              </p>
            </div>

            <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-12">
              {/* Header Branding */}
              <div className="mx-auto mb-6 w-full max-w-md text-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-stone-900 rounded"
                >
                  <span className="text-3xl" aria-hidden>📚</span>
                  <span className="text-3xl font-serif font-bold text-stone-900 tracking-tight">Book Worms</span>
                </Link>
                <p className="mt-2 text-sm text-stone-600">Your cozy corner for all fiction &amp; non-fiction</p>
              </div>

              {/* Centered Auth Card */}
              <div className="mx-auto w-full max-w-md">
                <div className="bg-white py-8 px-6 shadow-sm border border-stone-200 rounded-2xl sm:px-10">
                  {children}
                </div>
                <p className="mt-6 text-center text-sm">
                  <Link href="/product-catalog" className="text-stone-600 hover:text-stone-900 hover:underline">&larr; Keep browsing books</Link>
                </p>
              </div>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
