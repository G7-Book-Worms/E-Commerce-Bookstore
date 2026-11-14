'use client';

// One Mailbox entry: mail that reached support@ and was classified as machine traffic (a DMARC
// report, a bounce, an auto-reply). "Convert to ticket" re-opens it into the queue when the
// classifier got it wrong.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { staffFetch } from '@/components/staff/staff-fetch';

export function MailboxRow({
  ticketId,
  subject,
  from,
  received,
  canConvert,
}: {
  ticketId: number;
  subject: string;
  from: string;
  received: string;
  canConvert: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function convert() {
    setBusy(true);
    const res = await staffFetch(`/api/staff/tickets/${ticketId}/convert`, 'POST');
    setBusy(false);
    setMsg(res.message);
    if (res.ok) router.refresh();
  }

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-48 shrink-0 truncate text-xs text-stone-500">{from}</span>
      {/* Subject and sender are untrusted email text; React escapes both */}
      <Link href={`/admin/messages/${ticketId}`} className="min-w-0 flex-1 truncate text-sm text-stone-700 underline-offset-2 hover:underline">
        {subject}
      </Link>
      <span className="shrink-0 text-xs text-stone-500">{received}</span>
      {canConvert && (
        <button
          type="button"
          className="shrink-0 text-xs text-green-900 underline underline-offset-2 hover:text-green-700 disabled:opacity-50"
          onClick={convert}
          disabled={busy}
        >
          {busy ? 'Converting…' : 'Convert to ticket'}
        </button>
      )}
      {msg && <span role="status" className="shrink-0 text-xs text-stone-600">{msg}</span>}
    </li>
  );
}
