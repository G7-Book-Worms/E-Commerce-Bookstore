// The staff inbox. Three tabs:
//   Tickets  - the support queue, threaded, filtered by status and assignee
//   Alerts   - staff_notifications (low stock, sold out) with an unread badge
//   Mailbox  - mail that reached support@ but is not a customer conversation
//
// Opening the inbox also pulls new mail from support@, throttled to once a minute and
// swallowing its own failures, so a mail server that is down only means an empty tab.
import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { can } from '@/lib/staff-permissions';
import { assignableStaff, listMailbox, listTickets, ticketCounts } from '@/server/src/modules/tickets/ticket-service';
import { listNotifications, unreadNotificationCount } from '@/server/src/modules/tickets/notification-service';
import { isMailSyncConfigured, syncOnInboxOpen } from '@/server/src/modules/tickets/mail-sync';
import { ticketListQuerySchema } from '@/server/src/modules/tickets/ticket-schema';
import { Badge, EmptyState, PageHeader, dateTime } from '@/components/staff/ui';
import { AlertsPanel } from './alerts-panel';
import { MailboxRow } from './mailbox-row';
import { SyncButton } from './sync-button';
import { TICKET_BADGE } from './ticket-badge';

export const metadata = { title: 'Messages' };
type SP = Record<string, string | undefined>;

const TABS = [
  { value: 'tickets', label: 'Tickets' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'mailbox', label: 'Mailbox' },
] as const;

const STATUS_FILTERS = [
  { value: 'unresolved', label: 'Open & pending' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Awaiting customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
] as const;

/** A tab or filter link that keeps the parameters the other controls set. */
function filterHref(params: SP, changes: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...changes })) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/messages?${s}` : '/admin/messages';
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaffPage('messages.view');
  const sp = await searchParams;
  const tab = TABS.some((t) => t.value === sp.tab) ? sp.tab! : 'tickets';
  const canReply = can(staff.role, 'messages.reply');
  // Managers and above may move work onto someone else; an employee may only take it themselves.
  const canAssignOthers = can(staff.role, 'staff.manage');

  // Best effort, and never fatal: syncOnInboxOpen() returns a status instead of throwing.
  const sync = await syncOnInboxOpen();

  const [counts, unread, mailboxRows] = await Promise.all([ticketCounts(), unreadNotificationCount(), listMailbox()]);

  return (
    <>
      <PageHeader
        title="Messages"
        description="Support tickets from the store's contact form and from mail sent to support@bookwrms.store. Replies are emailed from support@ and stay on the same thread."
        actions={canReply ? <SyncButton configured={isMailSyncConfigured()} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const badge = t.value === 'alerts' ? unread : t.value === 'mailbox' ? mailboxRows.length : counts.unresolved;
          return (
            <Link
              key={t.value}
              href={filterHref(sp, { tab: t.value, status: undefined, assignedTo: undefined })}
              aria-current={tab === t.value ? 'true' : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${tab === t.value ? 'border-green-900 bg-green-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
            >
              {t.label}
              {badge > 0 && (
                <span className={`rounded-full px-1.5 text-xs font-semibold ${tab === t.value ? 'bg-white text-green-900' : 'bg-stone-200 text-stone-700'}`}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {sync.status === 'error' && (
        <p role="status" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Could not reach the support mailbox just now. Tickets already in the portal are still shown.
        </p>
      )}

      {tab === 'tickets' && <TicketsTab sp={sp} canAssignOthers={canAssignOthers} />}
      {tab === 'alerts' && <AlertsTab canReply={canReply} />}
      {tab === 'mailbox' && <MailboxTab rows={mailboxRows} canReply={canReply} configured={isMailSyncConfigured()} />}
    </>
  );
}

async function TicketsTab({ sp, canAssignOthers }: { sp: SP; canAssignOthers: boolean }) {
  // The same validation the API uses, so an edited URL cannot push anything odd into a query.
  const parsed = ticketListQuerySchema.safeParse({
    status: sp.status ?? 'unresolved',
    assignedTo: sp.assignedTo,
    q: sp.q,
  });
  const query = parsed.success ? parsed.data : { status: 'unresolved' as const };
  const [rows, staffList] = await Promise.all([listTickets(query), assignableStaff()]);
  const activeStatus = query.status ?? 'unresolved';

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={filterHref(sp, { tab: 'tickets', status: f.value })}
            aria-current={activeStatus === f.value ? 'true' : undefined}
            className={`rounded-md border px-2.5 py-1 text-xs ${activeStatus === f.value ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
          >
            {f.label}
          </Link>
        ))}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-stone-300" />
        <Link
          href={filterHref(sp, { tab: 'tickets', assignedTo: undefined })}
          className={`rounded-md border px-2.5 py-1 text-xs ${!sp.assignedTo ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
        >
          Anyone
        </Link>
        <Link
          href={filterHref(sp, { tab: 'tickets', assignedTo: 'unassigned' })}
          className={`rounded-md border px-2.5 py-1 text-xs ${sp.assignedTo === 'unassigned' ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
        >
          Unassigned
        </Link>
        {canAssignOthers &&
          staffList.map((s) => (
            <Link
              key={s.adminId}
              href={filterHref(sp, { tab: 'tickets', assignedTo: String(s.adminId) })}
              className={`rounded-md border px-2.5 py-1 text-xs ${sp.assignedTo === String(s.adminId) ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
            >
              {s.firstName}
            </Link>
          ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing to answer" text="No tickets match this filter." image="/images/empty-states/silver-tabby-kitten-walking.webp" />
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xs">
          {rows.map((t) => (
            <li key={t.ticketId}>
              <Link
                href={`/admin/messages/${t.ticketId}`}
                className={`flex flex-col gap-1 px-4 py-3 hover:bg-stone-50 sm:flex-row sm:items-center sm:gap-4 ${t.status === 'open' ? 'bg-amber-50/40' : ''}`}
              >
                <span className="shrink-0 font-mono text-xs text-stone-500">#{t.number}</span>
                <span className="w-40 shrink-0 truncate text-sm">{t.customerName}</span>
                {/* React escapes this, so HTML or script in a subject cannot run */}
                <span className={`min-w-0 flex-1 truncate text-sm ${t.status === 'open' ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>
                  {t.subject}
                </span>
                <span className="shrink-0 text-xs text-stone-500">{t.messageCount} msg</span>
                <span className="w-28 shrink-0 truncate text-xs text-stone-500">{t.assigneeName ?? 'Unassigned'}</span>
                <span className="shrink-0 text-xs text-stone-500">{dateTime(t.updated)}</span>
                <Badge color={TICKET_BADGE[t.status]?.color ?? 'gray'}>{TICKET_BADGE[t.status]?.label ?? t.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function AlertsTab({ canReply }: { canReply: boolean }) {
  const rows = await listNotifications();
  return <AlertsPanel rows={rows.map((r) => ({ ...r, created: String(r.created), readAt: r.readAt ? String(r.readAt) : null }))} canEdit={canReply} />;
}

function MailboxTab({
  rows,
  canReply,
  configured,
}: {
  rows: { ticketId: number; number: number; subject: string; customerName: string; customerEmail: string; created: Date }[];
  canReply: boolean;
  configured: boolean;
}) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Nothing in the mailbox"
        text={
          configured
            ? 'Mail that arrives at support@ but is not a customer message (delivery reports, bounces, auto-replies) shows up here.'
            : 'Mail sync is not configured in this environment, so nothing is being pulled from support@.'
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-2xs">
      {rows.map((m) => (
        <MailboxRow
          key={m.ticketId}
          ticketId={m.ticketId}
          subject={m.subject}
          from={m.customerEmail || m.customerName}
          received={dateTime(m.created)}
          canConvert={canReply}
        />
      ))}
    </ul>
  );
}

export default function MessagesPage(props: { searchParams: Promise<SP> }) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
