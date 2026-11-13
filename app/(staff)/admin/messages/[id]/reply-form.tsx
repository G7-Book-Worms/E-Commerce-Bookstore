'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary, btnSecondary } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

export function ReplyForm({ messageId, name, email, status }: { messageId: number; name: string; email: string; status: string }) {
  const router = useRouter();
  const [reply, setReply] = useState(`Hi ${name},\n\n\n\nThanks,\nBook Worms support`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await staffFetch(`/api/staff/messages/${messageId}`, 'POST', { reply });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) router.refresh();
  }

  async function setStatus(next: string) {
    const res = await staffFetch(`/api/staff/messages/${messageId}`, 'PATCH', { status: next });
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <label htmlFor="reply" className="text-sm text-stone-600">Emailed to <strong>{email}</strong> from support@bookwrms.store</label>
      <textarea id="reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={8} maxLength={5000}
        className="w-full rounded-md border border-stone-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800" />
      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} disabled={busy}>{busy ? 'Sending…' : 'Send reply'}</button>
        {status !== 'archived'
          ? <button type="button" className={btnSecondary} onClick={() => setStatus('archived')}>Archive</button>
          : <button type="button" className={btnSecondary} onClick={() => setStatus('read')}>Move to inbox</button>}
        {status !== 'new' && status !== 'archived' && <button type="button" className={btnSecondary} onClick={() => setStatus('new')}>Mark unread</button>}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </form>
  );
}
