'use client';

import { useState } from 'react';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { btnPrimary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

export function StaffPasswordForm({ email, temporary }: { email: string; temporary: boolean }) {
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [e.target.name]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await staffFetch('/api/staff/change-password', 'POST', f);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) setTimeout(() => (window.location.href = '/admin'), 800);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {msg && <p role="status" className={`rounded-md p-3 text-sm ${msg.ok ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>}
      <div className="space-y-1.5">
        <label htmlFor="cur" className="text-sm font-medium">{temporary ? 'Temporary password' : 'Current password'}</label>
        <PasswordInput id="cur" name="currentPassword" autoComplete="current-password" value={f.currentPassword} onChange={set} className={inputCls} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="new" className="text-sm font-medium">New password</label>
        <PasswordInput id="new" name="newPassword" autoComplete="new-password" value={f.newPassword} onChange={set} className={inputCls} aria-describedby="new-strength" />
        <PasswordStrength id="new-strength" password={f.newPassword} email={email} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">Confirm new password</label>
        <PasswordInput id="confirm" name="confirmPassword" autoComplete="new-password" value={f.confirmPassword} onChange={set} className={inputCls} />
      </div>
      <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  );
}
