'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import { StepUpPrompt, type StepUpRequest } from '@/components/staff/step-up-prompt';

type Details = { firstName: string; lastName: string; email: string; phone: string | null };

/**
 * Contact details for a customer. Changing the email address is limited to managers and up and
 * re-confirmed with the staff member's own password: sign-in codes and reset links follow the
 * email, so an email change is how an account would be taken over. The server enforces both.
 */
export function CustomerDetailsForm({ userId, initial, canChangeEmail }: { userId: number; initial: Details; canChangeEmail: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ ...initial, phone: initial.phone ?? '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<StepUpRequest | null>(null);
  const set = (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [e.target.name]: e.target.value });

  async function send(actorPassword?: string) {
    setBusy(true);
    const res = await staffFetch(`/api/staff/customers/${userId}`, 'PATCH', { action: 'update', ...f, ...(actorPassword ? { actorPassword } : {}) });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) router.refresh();
    return { ok: res.ok, message: res.message };
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.email.trim().toLowerCase() !== initial.email.toLowerCase()) {
      setPrompt({
        title: 'Change this customer\'s email address',
        description: `Sign-in codes, password resets and order emails will go to ${f.email.trim()} instead. The old address is told about the change.`,
        confirmLabel: 'Change email',
        run: (pw) => send(pw),
      });
      return;
    }
    void send();
  }

  return (
    <>
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <label className="text-sm"><span className="mb-1 block font-medium">First name</span><input name="firstName" value={f.firstName} onChange={set} className={inputCls} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Last name</span><input name="lastName" value={f.lastName} onChange={set} className={inputCls} required /></label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input name="email" type="email" value={f.email} onChange={set} className={inputCls} required readOnly={!canChangeEmail} aria-describedby={canChangeEmail ? undefined : 'email-locked'} />
          {!canChangeEmail && <span id="email-locked" className="mt-1 block text-xs text-stone-500">Only a manager can change a customer&apos;s email.</span>}
        </label>
        <label className="text-sm"><span className="mb-1 block font-medium">Phone</span><input name="phone" value={f.phone} onChange={set} className={inputCls} /></label>
      </div>
      <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save details'}</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </form>
    <StepUpPrompt request={prompt} onClose={() => setPrompt(null)} />
    </>
  );
}
