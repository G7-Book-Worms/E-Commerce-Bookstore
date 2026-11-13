import Link from 'next/link';
import { Suspense } from 'react';
import { Lock } from 'lucide-react';
import { StaffLoginForm } from './staff-login-form';

export const metadata = { title: 'Staff sign in' };

// One card (fixes the old page that nested a card inside the auth layout's card)
export default function StaffLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6 font-serif text-2xl font-bold text-green-900">Book Worms</Link>
      <div className="w-full max-w-sm rounded-xl border border-stone-200 border-t-4 border-t-green-900 bg-white p-6 shadow-md sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-900/10 text-green-900">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold">Staff sign in</h1>
          <p className="mt-1 text-sm text-stone-500">Authorized Book Worms staff only</p>
        </div>
        <Suspense>
          <StaffLoginForm />
        </Suspense>
      </div>
      <p className="mt-6 max-w-sm text-center text-xs text-stone-500">
        Shopping? <Link href="/user-login" className="underline underline-offset-2 hover:text-stone-800">Customer sign in</Link>.
        Every staff action is recorded in the activity log.
      </p>
    </main>
  );
}
