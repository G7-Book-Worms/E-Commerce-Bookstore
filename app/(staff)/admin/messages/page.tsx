import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listMessages } from '@/server/src/modules/contact/contact-service';
import { Badge, EmptyState, PageHeader, dateTime } from '@/components/staff/ui';

export const metadata = { title: 'Messages' };
type SP = Record<string, string | undefined>;

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'replied', label: 'Replied' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];
const MESSAGE_BADGE: Record<string, { label: string; color: 'amber' | 'gray' | 'green' | 'blue' }> = {
  new: { label: 'New', color: 'amber' },
  read: { label: 'Read', color: 'blue' },
  replied: { label: 'Replied', color: 'green' },
  archived: { label: 'Archived', color: 'gray' },
};

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaffPage('messages.view');
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp.status) ? sp.status! : 'open';
  const rows = await listMessages(tab);
  return (
    <>
      <PageHeader title="Messages" description="From the Contact Support form in the store footer. Replies are emailed from support@bookwrms.store." />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.value} href={`/admin/messages?status=${t.value}`} aria-current={tab === t.value ? 'true' : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${tab === t.value ? 'border-green-900 bg-green-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Inbox zero" text="No messages here." image="/images/empty-states/silver-tabby-kitten-walking.webp" />
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xs">
          {rows.map((m) => (
            <li key={m.messageId}>
              <Link href={`/admin/messages/${m.messageId}`} className={`flex flex-col gap-1 px-4 py-3 hover:bg-stone-50 sm:flex-row sm:items-center sm:gap-4 ${m.status === 'new' ? 'bg-amber-50/40' : ''}`}>
                <span className={`w-48 shrink-0 truncate ${m.status === 'new' ? 'font-semibold' : ''}`}>{m.name}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-600">{m.message}</span>
                <span className="shrink-0 text-xs text-stone-500">{dateTime(m.created)}</span>
                <Badge color={MESSAGE_BADGE[m.status].color}>{MESSAGE_BADGE[m.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function MessagesPage(props: { searchParams: Promise<SP> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}
