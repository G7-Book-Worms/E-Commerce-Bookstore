'use client';

// Account → Security → "Your data" (SCRUM-216): download a copy of everything we store about
// you, or delete the account. The server re-checks the password and the DELETE confirmation.
import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';

export function PrivacyCard() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (confirm.trim().toUpperCase() !== 'DELETE') return setError('Type DELETE to confirm.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try {
      const res = await fetch('/api/users/my-data', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) throw new Error(json?.error || 'Something went wrong. Try again.');
      window.location.href = '/?account=deleted';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-stone-600">
          Download everything we store about you: profile, addresses, orders, messages to support, sign-in settings and account activity.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Why we keep it: your account and saved addresses until you delete them; orders and payments (card brand and last four
          digits only) as the store&apos;s sales records; sign-in activity for security. We never store your full card number, and
          passwords and passkeys are stored only in a form that can&apos;t be read back.
        </p>
        <a
          href="/api/users/my-data"
          download
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900 hover:bg-stone-50"
        >
          <Download className="size-4" aria-hidden /> Download my data (JSON)
        </a>
      </div>

      <div className="border-t border-stone-200 pt-4">
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <Trash2 className="size-4" aria-hidden /> Delete my account
          </button>
        ) : (
          <form onSubmit={remove} className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-900">
              <strong>This can&apos;t be undone.</strong> Your name, email, phone, addresses, saved cart, passkeys and sign-in
              settings are erased and you&apos;re signed out. Orders you placed stay in our sales records without your details.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Your password</span>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus className="h-10 w-full rounded-md border border-stone-300 bg-white px-3" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Type DELETE to confirm</span>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="h-10 w-full rounded-md border border-stone-300 bg-white px-3" />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="h-10 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60">
                {busy ? 'Deleting…' : 'Delete my account forever'}
              </button>
              <button type="button" onClick={() => { setOpen(false); setPassword(''); setConfirm(''); setError(null); }} className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
