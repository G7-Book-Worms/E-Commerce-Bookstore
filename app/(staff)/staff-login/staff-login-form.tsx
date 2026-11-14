'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PasswordInput } from '@/components/ui/password-input';
import { btnPrimary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

export function StaffLoginForm() {
  const params = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', employeeId: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.password || !form.employeeId) {
      setError('Fill in all three fields');
      return;
    }
    setBusy(true);
    const res = await staffFetch<{ mustChangePassword: boolean }>('/api/staff/login', 'POST', form);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const next = params.get('callbackUrl');
    window.location.href = res.data?.mustChangePassword
      ? '/admin/change-password'
      : next && next.startsWith('/admin') ? next : '/admin';
  }

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
        <input id="staff-email" name="email" type="email" autoComplete="username" value={form.email} onChange={set} className={inputCls} disabled={busy} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="staff-password" className="text-sm font-medium">Password</label>
        <PasswordInput id="staff-password" name="password" autoComplete="current-password" value={form.password} onChange={set} className={inputCls} disabled={busy} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="staff-employee-id" className="text-sm font-medium">Employee ID</label>
        <input id="staff-employee-id" name="employeeId" placeholder="BW-1001" autoComplete="off" value={form.employeeId} onChange={set} className={`${inputCls} uppercase`} disabled={busy} />
      </div>
      <button type="submit" className={`${btnPrimary} w-full`} disabled={busy} aria-busy={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-xs text-stone-500">Forgot your password? Ask an administrator for a temporary one.</p>
    </form>
  );
}
