'use client';

// Sign-up, step 2: type the 6-digit code we emailed. The account is only created once it's right.
// Who is signing up is in an httpOnly cookie from step 1, so this form only ever sends the code.
import { useEffect, useRef, useState } from 'react';
import { AuthApiError, resendRegistrationCode, verifyRegistration, type UserSession } from '@/lib/api/auth';

export function VerifyEmailStep({ sentTo, onVerified, onStartOver }: {
  sentTo: string | null;
  onVerified: (user: UserSession) => void;
  onStartOver: () => void;
}) {
  const [to, setTo] = useState(sentTo);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

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
    try {
      const { user } = await verifyRegistration(digits);
      onVerified(user);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "We couldn't check that code. Try again.");
      setCode('');
      setBusy(false);
      input.current?.focus();
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const res = await resendRegistrationCode();
      setTo(res.sentTo ?? to);
      setCode('');
      setNotice(`A new code is on its way${res.sentTo ? ` to ${res.sentTo}` : ''}. The old one no longer works.`);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "We couldn't send a new code.");
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-labelledby="verify-email-title">
      <div className="space-y-1">
        <h2 id="verify-email-title" className="font-serif text-2xl font-bold tracking-tight text-neutral-900">Confirm Your Email</h2>
        <p className="text-sm text-neutral-600">
          We emailed a 6-digit code{to ? ` to ${to}` : ''}. Enter it to finish creating your account. It expires in 15 minutes.
        </p>
      </div>

      {notice && !error && <p role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <div className="space-y-1.5">
        <label htmlFor="verify-email-code" className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">Confirmation code</label>
        <input
          ref={input}
          id="verify-email-code"
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

      <button type="submit" disabled={busy} aria-busy={busy} className="flex h-10 w-full items-center justify-center rounded-md bg-neutral-900 text-sm font-medium text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-60">
        {busy ? 'Checking…' : 'Confirm and create account'}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={resend} disabled={busy} className="min-h-10 font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 disabled:opacity-50">
          Send a New Code
        </button>
        <button type="button" onClick={onStartOver} disabled={busy} className="min-h-10 text-neutral-600 underline underline-offset-4 hover:text-neutral-900 disabled:opacity-50">
          Use a Different Email
        </button>
      </div>
      <p className="text-xs text-neutral-500">Can&apos;t find it? Check your spam or junk folder.</p>
    </form>
  );
}
