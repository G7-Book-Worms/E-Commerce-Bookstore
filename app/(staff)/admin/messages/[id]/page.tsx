// One support ticket: the whole conversation in order, plus the reply box and the
// status/assignee controls.
//
// 'messages.view' is required to render at all, so a role without it is redirected rather than
// shown a thread it guessed the id of. The reply controls additionally need 'messages.reply',
// and the API checks the same permissions again - the UI hiding a control is never the only
// thing stopping the action.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { can } from '@/lib/staff-permissions';
import { assignableStaff, getTicket } from '@/server/src/modules/tickets/ticket-service';
import { ticketIdParam } from '@/server/src/modules/tickets/ticket-schema';
import { Badge, PageHeader, Panel, dateTime } from '@/components/staff/ui';
import { TICKET_BADGE } from '../ticket-badge';
import { TicketActions } from './ticket-actions';

export const metadata = { title: 'Ticket' };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage('messages.view');
  // Same validation as the API; a bad id is a 404 page, not a thrown query.
  let id: number;
  try {
    id = ticketIdParam((await params).id);
  } catch {
    notFound();
  }

  const ticket = await getTicket(id).catch(() => null);
  if (!ticket) notFound();

  const canReply = can(staff.role, 'messages.reply');
  const canAssignOthers = can(staff.role, 'staff.manage');
  const staffList = canAssignOthers ? await assignableStaff() : [];
  const badge = TICKET_BADGE[ticket.status] ?? { label: ticket.status, color: 'gray' as const };

  return (
    <>
      <Link href="/admin/messages" className="mb-3 inline-block text-sm text-stone-500 underline-offset-2 hover:underline">
        ← Inbox
      </Link>
      {/* Subject, name and email are customer-supplied; React escapes all three */}
      <PageHeader
        title={`#${ticket.number} · ${ticket.subject}`}
        description={`${ticket.customerName} · ${ticket.customerEmail} · opened ${dateTime(ticket.created)}${ticket.userId ? ' · signed-in customer' : ''}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Badge color={badge.color}>{badge.label}</Badge>
        <span className="text-stone-500">{ticket.assigneeName ? `Assigned to ${ticket.assigneeName}` : 'Unassigned'}</span>
      </div>

      <div className="grid max-w-3xl gap-4">
        {ticket.messages.length === 0 ? (
          <Panel title="Conversation">
            <p className="text-sm text-stone-500">This ticket has no messages yet.</p>
          </Panel>
        ) : (
          ticket.messages.map((m) => (
            <div
              key={m.ticketMessageId}
              className={`rounded-lg border p-4 shadow-2xs ${m.direction === 'out' ? 'border-green-200 bg-green-50/60' : 'border-stone-200 bg-white'}`}
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-stone-500">
                <span className="font-medium text-stone-700">
                  {m.direction === 'out' ? `${m.staffName ?? 'Book Worms support'} (staff)` : m.fromEmail}
                </span>
                <span>{dateTime(m.created)}</span>
              </div>
              {/* Plain text: React escapes it, so HTML or script inside an email cannot run */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
            </div>
          ))
        )}

        {canReply && (
          <Panel title="Reply">
            <TicketActions
              ticketId={ticket.ticketId}
              number={ticket.number}
              customerName={ticket.customerName}
              customerEmail={ticket.customerEmail}
              status={ticket.status}
              assignedTo={ticket.assignedTo}
              me={{ id: staff.id, name: `${staff.firstName} ${staff.lastName}` }}
              staffList={staffList.map((s) => ({ id: s.adminId, name: `${s.firstName} ${s.lastName}` }))}
              canAssignOthers={canAssignOthers}
            />
          </Panel>
        )}
      </div>
    </>
  );
}

export default function TicketPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
