'use client';

// The second step of signing in (customers who turned it on, and every staff member):
// type the 6-digit code from the email or the authenticator app.
//
// It only ever talks to /api/mfa/*; who is signing in is in an httpOnly cookie the password
// step set, so nothing here can be pointed at another account.
import { useEffect, useRef, useState } from 'react';

type Method = 'email' | 'totp';

export interface TwoStepPromptProps {
  method: Method;
  sentTo: string | null;
  /** Called with the /api/mfa/verify data on success */
  onSuccess: (data: Record<string, unknown>) => void;
  /** "Use a different account" / start again */
  onCancel: () => void;
  /** Visual style: the shop's neutral look or the staff portal's green */
  tone?: 'shop' | 'staff';
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.success !== false, data: json?.data ?? {}, message: json?.error || json?.message || 'Something went wrong. Try again.' };
}

export function TwoStepPrompt({ method: initialMethod, sentTo: initialSentTo, onSuccess, onCancel, tone = 'shop' }: TwoStepPromptProps) {
  const [method, setMethod] = useState<Method>(initialMethod);
  const [sentTo, setSentTo] = useState(initialSentTo);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), [method]);

  const primary = tone === 'staff'
    ? 'bg-green-900 hover:bg-green-800 focus-visible:ring-green-800'
    : 'bg-neutral-900 hover:bg-neutral-800 focus-visible:ring-neutral-900';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError('Enter all 6 digits of the code.');
      input.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await post('/api/mfa/verify', { code: digits });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      setCode('');
      input.current?.focus();
      return;
    }
    onSuccess(res.data);
  }

  async function sendEmailCode() {
    setBusy(true);
    setError(null);
    const res = await post('/api/mfa/resend');
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setMethod('email');
    setSentTo(res.data.sentTo ?? null);
    setCode('');
    setNotice(`A new code is on its way${res.data.sentTo ? ` to ${res.data.sentTo}` : ''}.`);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-labelledby="two-step-title">
      <div className="space-y-1">
        <h2 id="two-step-title" className="font-serif text-2xl font-bold tracking-tight text-neutral-900">Check it&apos;s you</h2>
        <p className="text-sm text-neutral-600">
          {method === 'totp'
            ? 'Open your authenticator app and enter the 6-digit code for Book Worms.'
            : `We emailed a 6-digit code${sentTo ? ` to ${sentTo}` : ''}. It expires in 10 minutes.`}
        </p>
      </div>

      {notice && !error && <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="space-y-1.5">
        <label htmlFor="two-step-code" className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">Sign-in code</label>
        <input
          ref={input}
          id="two-step-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/[^\d ]/g, '')); setError(null); }}
          disabled={busy}
          aria-invalid={!!error || undefined}
          className="h-12 w-full rounded-md border border-neutral-300 bg-white px-3 text-center font-mono text-2xl tracking-[0.4em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-50"
          placeholder="••••••"
        />
      </div>

      <button type="submit" disabled={busy} aria-busy={busy} className={`flex h-10 w-full items-center justify-center rounded-md text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 ${primary}`}>
        {busy ? 'Checking…' : 'Verify and sign in'}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button type="button" onClick={sendEmailCode} disabled={busy} className="text-neutral-600 underline underline-offset-4 hover:text-neutral-900 disabled:opacity-50">
          {method === 'totp' ? 'Email me a code instead' : 'Send a new code'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="text-neutral-600 underline underline-offset-4 hover:text-neutral-900 disabled:opacity-50">
          Start over
        </button>
      </div>
    </form>
  );
}
