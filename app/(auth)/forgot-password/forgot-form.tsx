'use client';

import Link from 'next/link';
import { useState } from 'react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => null);
      setState({ ok: res.ok, text: res.ok ? json?.message : json?.error ?? 'Something went wrong. Try again.' });
    } catch {
      setState({ ok: false, text: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-left">
      <h2 className="text-2xl font-bold tracking-tight text-neutral-900 font-serif">Forgot your password?</h2>
      {state?.ok ? (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          {state.text} Check your spam folder if it doesn&apos;t arrive in a few minutes.
        </div>
      ) : (
        <>
          <p className="text-sm text-neutral-600">Enter the email on your account and we&apos;ll send you a link to choose a new password.</p>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {state && !state.ok && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{state.text}</p>}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">Email address</label>
              <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900" />
            </div>
            <button type="submit" disabled={busy || !email} className="h-10 w-full rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60">
              {busy ? 'Sending…' : 'Email me a reset link'}
            </button>
          </form>
        </>
      )}
      <Link href="/user-login" className="inline-block text-sm font-medium text-neutral-900 underline underline-offset-4">&larr; Back to sign in</Link>
    </div>
  );
}
