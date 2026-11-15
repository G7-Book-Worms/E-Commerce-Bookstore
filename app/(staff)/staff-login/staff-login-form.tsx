'use client';
import { safeInternalPath } from '@/lib/safe-redirect';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordInput } from '@/components/ui/password-input';
import { btnPrimary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { TwoStepPrompt } from '@/components/auth/two-step-prompt';

// Field order matters: the password comes last so that pressing Enter in it signs in.
const FIELDS = [
  { name: 'email', id: 'staff-email', label: 'Work email' },
  { name: 'employeeId', id: 'staff-employee-id', label: 'Employee ID' },
  { name: 'password', id: 'staff-password', label: 'Password' },
] as const;
type FieldName = (typeof FIELDS)[number]['name'];

export function StaffLoginForm() {
  const params = useSearchParams();
  const [form, setForm] = useState<Record<FieldName, string>>({ email: '', employeeId: '', password: '' });
  const [missing, setMissing] = useState<FieldName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Every staff sign-in has a second step (a code by email or from an authenticator app)
  const [twoStep, setTwoStep] = useState<{ method: 'email' | 'totp' | 'sms'; sentTo: string | null } | null>(null);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
    if (e.target.name === missing) setMissing(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Point at the first empty field instead of a generic "fill everything in"
    const empty = FIELDS.find((f) => !form[f.name].trim());
    if (empty) {
      setError(null);
      setMissing(empty.name);
      document.getElementById(empty.id)?.focus();
      return;
    }
    setMissing(null);
    setBusy(true);
    const res = await staffFetch<{ mfaRequired?: boolean; method?: 'email' | 'totp' | 'sms'; sentTo?: string | null }>('/api/staff/login', 'POST', form);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const m = res.data?.method;
    setTwoStep({ method: m === 'totp' || m === 'sms' ? m : 'email', sentTo: res.data?.sentTo ?? null });
  }

  function signedIn(mustChangePassword: boolean) {
    const next = params.get('callbackUrl');
    window.location.href = mustChangePassword
      ? '/admin/change-password'
      : safeInternalPath(next, '/admin', '/admin');
  }

  if (twoStep) {
    return (
      <TwoStepPrompt
        tone="staff"
        method={twoStep.method}
        sentTo={twoStep.sentTo}
        onCancel={() => { setTwoStep(null); setForm((f) => ({ ...f, password: '' })); }}
        onSuccess={(data) => signedIn(!!data.mustChangePassword)}
      />
    );
  }

  // aria-invalid + a message tied to the field with aria-describedby, so screen readers announce it
  const fieldProps = (name: FieldName, id: string) => ({
    'aria-invalid': missing === name || undefined,
    'aria-describedby': missing === name ? `${id}-missing` : undefined,
  });
  const missingNote = (name: FieldName, id: string, label: string) =>
    missing === name ? (
      <p id={`${id}-missing`} role="alert" className="text-xs font-medium text-red-700">{label} is missing. Fill it in to sign in.</p>
    ) : null;
  const invalidCls = (name: FieldName) => (missing === name ? ' border-red-400 ring-1 ring-red-300' : '');

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {params.get('passwordChanged') === '1' && !error && (
        <div role="status" className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Your password was changed, so every staff session was signed out - this browser included. Sign in with your new password.
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="staff-email" className="text-sm font-medium">Work email</label>
        <input id="staff-email" name="email" type="email" autoComplete="username" value={form.email} onChange={set} className={inputCls + invalidCls('email')} disabled={busy} {...fieldProps('email', 'staff-email')} />
        {missingNote('email', 'staff-email', 'Work email')}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="staff-employee-id" className="text-sm font-medium">Employee ID</label>
        <input id="staff-employee-id" name="employeeId" placeholder="BW-1001" autoComplete="off" value={form.employeeId} onChange={set} className={`${inputCls} uppercase${invalidCls('employeeId')}`} disabled={busy} {...fieldProps('employeeId', 'staff-employee-id')} />
        {missingNote('employeeId', 'staff-employee-id', 'Employee ID')}
      </div>
      <div className="space-y-1.5">
        <label htmlFor="staff-password" className="text-sm font-medium">Password</label>
        <PasswordInput id="staff-password" name="password" autoComplete="current-password" value={form.password} onChange={set} className={inputCls + invalidCls('password')} disabled={busy} {...fieldProps('password', 'staff-password')} />
        {missingNote('password', 'staff-password', 'Password')}
      </div>
      <button type="submit" className={`${btnPrimary} w-full`} disabled={busy} aria-busy={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-xs text-stone-500">Forgot your password? Ask an administrator for a temporary one.</p>
    </form>
  );
}
