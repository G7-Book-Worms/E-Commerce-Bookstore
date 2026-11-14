'use client';

// The Alerts tab: staff_notifications rows (low stock, sold out) with a mark-read control.
// These used to be emailed to support@ only, which is why an alert that fired looked like a
// bug - there was nowhere in the portal for it to appear.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, EmptyState, btnSecondary, dateTime } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

export interface AlertRow {
  notificationId: number;
  kind: string;
  title: string;
  body: string | null;
  subjectType: string | null;
  subjectId: number | null;
  readAt: string | null;
  created: string;
}

const KIND_BADGE: Record<string, { label: string; color: 'amber' | 'red' | 'gray' }> = {
  low_stock: { label: 'Low stock', color: 'amber' },
  sold_out: { label: 'Sold out', color: 'red' },
};

export function AlertsPanel({ rows, canEdit }: { rows: AlertRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const unread = rows.filter((r) => !r.readAt).length;

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    const res = await staffFetch('/api/staff/tickets/alerts', 'PATCH', body);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) router.refresh();
  }

  if (!rows.length) {
    return <EmptyState title="No alerts" text="Low-stock and sold-out alerts show up here as well as being emailed to support@." />;
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <p className="text-sm text-stone-600">{unread} unread of {rows.length}</p>
        {canEdit && unread > 0 && (
          <button type="button" className={btnSecondary} onClick={() => send({ all: true })} disabled={busy}>
            Mark all read
          </button>
        )}
        {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</span>}
      </div>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xs">
        {rows.map((a) => {
          const badge = KIND_BADGE[a.kind] ?? { label: a.kind, color: 'gray' as const };
          return (
            <li key={a.notificationId} className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${a.readAt ? '' : 'bg-amber-50/40'}`}>
              <Badge color={badge.color}>{badge.label}</Badge>
              <div className="min-w-0 flex-1">
                {/* Titles are built on the server from book data, and React escapes them anyway */}
                <p className={`truncate text-sm ${a.readAt ? 'text-stone-700' : 'font-semibold text-stone-900'}`}>{a.title}</p>
                {a.body && <p className="truncate text-xs text-stone-500">{a.body}</p>}
              </div>
              {a.subjectType === 'book' && a.subjectId !== null && (
                <Link href={`/admin/books/${a.subjectId}`} className="shrink-0 text-xs text-green-900 underline underline-offset-2">
                  Open book
                </Link>
              )}
              <span className="shrink-0 text-xs text-stone-500">{dateTime(a.created)}</span>
              {canEdit && !a.readAt && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900 disabled:opacity-50"
                  onClick={() => send({ notificationId: a.notificationId })}
                  disabled={busy}
                >
                  Mark read
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
