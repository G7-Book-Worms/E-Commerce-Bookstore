import { Suspense } from 'react';
import { LockAccountForm } from './lock-form';

// The "Lock My Account" link from the account-unlocked email. The token in the URL must not leak
// to other sites through the Referer header.
export const metadata = { title: 'Lock Your Account | Book Worms', robots: { index: false }, referrer: 'no-referrer' as const };

export default function LockAccountPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-neutral-100" />}>
      <LockAccountForm />
    </Suspense>
  );
}
