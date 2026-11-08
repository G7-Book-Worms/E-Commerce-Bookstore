// app/(auth)/layout.tsx
import '../globals.css';
import React from 'react';
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
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <AuthProvider>
          {/* Header Branding */}
          <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-stone-900 rounded"
            >
              <span className="text-3xl">📚</span>
              <h1 className="text-3xl font-serif font-bold text-stone-900 tracking-tight">
                Book Worms
              </h1>
            </Link>
            <p className="mt-2 text-sm text-stone-600">
              Your cozy corner for all fiction & non-fiction
            </p>
          </div>

          {/* Centered Auth Card */}
          <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
            <div className="bg-white py-8 px-6 shadow-sm border border-stone-200 rounded-2xl sm:px-10">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}