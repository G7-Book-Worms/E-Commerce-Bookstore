'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';

const field = 'h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900';

export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [f, setF] = useState({ newPassword: '', confirmPassword: '' });
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...f }),
      });
      const json = await res.json().catch(() => null);
      setState({ ok: res.ok, text: res.ok ? json?.message : json?.error ?? 'Something went wrong.' });
    } catch {
      setState({ ok: false, text: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-3 text-left">
        <h2 className="font-serif text-2xl font-bold">This link is incomplete</h2>
        <p className="text-sm text-neutral-600">Open the link from your email again, or request a new one.</p>
        <Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <h2 className="font-serif text-2xl font-bold tracking-tight">Choose a new password</h2>
      {state?.ok ? (
        <div role="status" className="space-y-3">
          <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">{state.text} Every device that was signed in has been signed out.</p>
          <Link href="/user-login" className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white">Sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {state && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {state.text} {state.text.includes('expired') && <Link href="/forgot-password" className="underline">Request a new link</Link>}
            </p>
          )}
          <div className="space-y-1.5">
            <label htmlFor="newPassword" className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">New password</label>
            <PasswordInput id="newPassword" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} className={field} />
            <PasswordStrength password={f.newPassword} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">Confirm new password</label>
            <PasswordInput id="confirmPassword" autoComplete="new-password" value={f.confirmPassword} onChange={(e) => setF({ ...f, confirmPassword: e.target.value })} className={field} reveal={false} />
          </div>
          <button type="submit" disabled={busy} className="h-10 w-full rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60">
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </div>
  );
}
