'use client';

// Reply box, status control and assignee control for one ticket. Each action is a call to the
// staff API, which re-checks the permission; this component only decides what to show.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary, btnSecondary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Awaiting customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function TicketActions({
  ticketId,
  number,
  customerName,
  customerEmail,
  status,
  assignedTo,
  me,
  staffList,
  canAssignOthers,
}: {
  ticketId: number;
  number: number;
  customerName: string;
  customerEmail: string;
  status: string;
  assignedTo: number | null;
  me: { id: number; name: string };
  staffList: { id: number; name: string }[];
  canAssignOthers: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState(`Hi ${customerName},\n\n\n\nThanks,\nBook Worms support`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(method: string, payload: unknown, url = `/api/staff/tickets/${ticketId}`) {
    setBusy(true);
    const res = await staffFetch(url, method, payload);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) router.refresh();
    return res.ok;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call('POST', { body });
    if (ok) setBody(`Hi ${customerName},\n\n\n\nThanks,\nBook Worms support`);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={send} className="space-y-3">
        <label htmlFor="reply" className="block text-sm text-stone-600">
          Emailed to <strong>{customerEmail}</strong> from support@bookwrms.store, with subject{' '}
          <span className="font-mono text-xs">Re: [Ticket #{number}] …</span> so the customer&apos;s answer stays on this thread.
        </label>
        <textarea
          id="reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={5000}
          className="w-full rounded-md border border-stone-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800"
        />
        <button className={btnPrimary} disabled={busy}>
          {busy ? 'Sending…' : 'Send reply'}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
        <label htmlFor="status" className="text-sm text-stone-600">
          Status
        </label>
        <select
          id="status"
          className={`${inputCls} w-44`}
          value={status}
          onChange={(e) => call('PATCH', { status: e.target.value })}
          disabled={busy}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <label htmlFor="assignee" className="text-sm text-stone-600">
          Assignee
        </label>
        {canAssignOthers ? (
          <select
            id="assignee"
            className={`${inputCls} w-52`}
            value={assignedTo ?? ''}
            onChange={(e) => call('PATCH', { assignedTo: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={busy}
          >
            <option value="">Unassigned</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : assignedTo === me.id ? (
          <button type="button" className={btnSecondary} onClick={() => call('PATCH', { assignedTo: null })} disabled={busy}>
            Give it up
          </button>
        ) : (
          // An employee may take a ticket for themselves but not hand it to somebody else.
          <button type="button" className={btnSecondary} onClick={() => call('PATCH', { assignedTo: me.id })} disabled={busy}>
            Assign to me
          </button>
        )}
      </div>

      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
