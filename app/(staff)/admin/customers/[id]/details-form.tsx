'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

export function CustomerDetailsForm({ userId, initial }: { userId: number; initial: { firstName: string; lastName: string; email: string; phone: string | null } }) {
  const router = useRouter();
  const [f, setF] = useState({ ...initial, phone: initial.phone ?? '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [e.target.name]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await staffFetch(`/api/staff/customers/${userId}`, 'PATCH', { action: 'update', ...f });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <label className="text-sm"><span className="mb-1 block font-medium">First name</span><input name="firstName" value={f.firstName} onChange={set} className={inputCls} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Last name</span><input name="lastName" value={f.lastName} onChange={set} className={inputCls} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Email</span><input name="email" type="email" value={f.email} onChange={set} className={inputCls} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Phone</span><input name="phone" value={f.phone} onChange={set} className={inputCls} /></label>
      </div>
      <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </form>
  );
}
