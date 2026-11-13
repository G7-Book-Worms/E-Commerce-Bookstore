'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnDanger, btnSecondary } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { TempPasswordNotice } from '@/components/staff/temp-password-notice';

export function CustomerActions({ userId, isActive, name }: { userId: number; isActive: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  async function act(action: string, confirmText: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    const res = await staffFetch<{ password?: string }>(`/api/staff/customers/${userId}`, 'PATCH', { action });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok && res.data?.password) setPassword(res.data.password);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        <button type="button" disabled={busy} className={btnSecondary} onClick={() => act('temp-password', `Give ${name} a temporary password? Their current password stops working and they're signed out everywhere.`)}>
          Set temporary password
        </button>
        <button type="button" disabled={busy} className={btnSecondary} onClick={() => act('sign-out', `Sign ${name} out of every device?`)}>
          Sign out everywhere
        </button>
        {isActive ? (
          <button type="button" disabled={busy} className={btnDanger} onClick={() => act('deactivate', `Deactivate ${name}'s account? They won't be able to sign in until it's reactivated.`)}>
            Deactivate account
          </button>
        ) : (
          <button type="button" disabled={busy} className={btnSecondary} onClick={() => act('activate', `Reactivate ${name}'s account?`)}>
            Reactivate account
          </button>
        )}
      </div>
      {password && <TempPasswordNotice password={password} who={name} />}
      {msg && !password && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
