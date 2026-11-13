import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { getMessage } from '@/server/src/modules/contact/contact-service';
import { can } from '@/lib/staff-permissions';
import { PageHeader, Panel, dateTime } from '@/components/staff/ui';
import { ReplyForm } from './reply-form';

export const metadata = { title: 'Message' };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage('messages.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const row = await getMessage(id).catch(() => null);
  if (!row) notFound();
  const m = row.message;
  return (
    <>
      <Link href="/admin/messages" className="mb-3 inline-block text-sm text-stone-500 underline-offset-2 hover:underline">← Inbox</Link>
      <PageHeader title={`Message from ${m.name}`} description={`${m.email} · ${dateTime(m.created)}${m.userId ? ' · signed-in customer' : ''}`} />
      <div className="grid max-w-3xl gap-6">
        <Panel title="Message">
          {/* Shown as plain text: React escapes it, so HTML in a message can't run */}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
        </Panel>
        {m.reply && (
          <Panel title={`Reply sent ${dateTime(m.repliedAt)}${row.repliedByName ? ` by ${row.repliedByName}` : ''}`}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.reply}</p>
          </Panel>
        )}
        {can(staff.role, 'messages.reply') && (
          <Panel title={m.reply ? 'Send another reply' : 'Reply'}>
            <ReplyForm messageId={m.messageId} name={m.name} email={m.email} status={m.status} />
          </Panel>
        )}
      </div>
    </>
  );
}

export default function MessagePage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}
