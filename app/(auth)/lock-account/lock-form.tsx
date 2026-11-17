'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function LockAccountForm() {
  const token = useSearchParams().get('token');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<number | null>(null);
  const [kind, setKind] = useState<'customer' | 'staff'>('customer');

  async function lock() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/relock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || 'We could not lock your account. Please contact support.');
      setTicket(json.data.ticketNumber);
      if (json.data.kind === 'staff') setKind('staff');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (ticket !== null) {
    return (
      <div className="space-y-4" role="status">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-neutral-900">Your Account Is Locked</h2>
        <p className="text-sm text-neutral-700">
          We signed your account out on every device, removed its passkeys, and locked sign-in for 7 days. We also opened support ticket{' '}
          <strong>#{ticket}</strong>, and our team will contact you by email to help secure your account.
        </p>
        {kind === 'staff' ? (
          <p className="text-sm text-neutral-700">
            To regain access, ask an administrator to check your account and set a temporary password. That ends the lock.
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-700">
              To regain access yourself, reset your password. That ends the lock immediately.
            </p>
            <Link href="/forgot-password" className="inline-flex h-10 w-full items-center justify-center rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800">
              Reset Your Password
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-neutral-900">Lock Your Account</h2>
        <p className="text-sm text-neutral-600">
          Use this if you did not ask Book Worms Support to unlock your account. We will:
        </p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
        <li>sign your account out on every device,</li>
        <li>lock sign-in for 7 days,</li>
        <li>remove your passkeys (add yours again after you reset your password), and</li>
        <li>open a support ticket so our team can help you secure your account.</li>
      </ul>
      {!token && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">This link is incomplete. Open it again from the email, or contact support.</p>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button
        type="button"
        onClick={lock}
        disabled={busy || !token}
        className="flex h-10 w-full items-center justify-center rounded-md bg-red-700 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:opacity-60"
      >
        {busy ? 'Locking…' : 'Lock My Account'}
      </button>
      <p className="text-xs text-neutral-500">
        Asked us to unlock it? You can ignore this page. <Link href="/user-login" className="underline">Sign in</Link>
      </p>
    </div>
  );
}
