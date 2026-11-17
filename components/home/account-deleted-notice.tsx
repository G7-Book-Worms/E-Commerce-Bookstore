'use client';

// Shown on the homepage after someone deletes their own account (/?account=deleted).
import { useSearchParams } from 'next/navigation';

export function AccountDeletedNotice() {
  if (useSearchParams().get('account') !== 'deleted') return null;
  return (
    <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
      Your account was deleted and you&apos;re signed out. We emailed you a confirmation. Thanks for reading with us.
    </p>
  );
}
