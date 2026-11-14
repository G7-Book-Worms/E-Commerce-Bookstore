// Support tickets: a threaded conversation with one customer, opened by the footer contact form
// or by mail arriving at support@. Replaces the flat one-reply contact_messages table for the
// staff inbox; contact_messages itself is left alone because the Session 3 demo still reads it.
//
// Every query here goes through Drizzle, so customer-supplied text is always a bound parameter
// and never part of a SQL string.
import 'server-only';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { admin, ticketMessages, tickets, users } from '../../../db/schema';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { sendEmail } from '../email/mailer';
import { ticketReceivedEmail, ticketReplyEmail } from '../email/templates';
import { newOutboundMessageId, sendThreadedEmail } from './ticket-mailer';
import type { NewTicketInput, TicketListQuery, TicketStatus } from './ticket-schema';
import {
  buildReferences,
  buildReplySubject,
  TICKET_NUMBER_BASE,
  isMachineMail,
  type ThreadLookup,
} from './ticket-threading';

/** How many candidate rows the mailbox tab scans before filtering in JS. See listMailbox(). */
const MAILBOX_SCAN_LIMIT = 300;

function isDuplicateKeyError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const errno = (err as { errno?: number })?.errno;
  return code === 'ER_DUP_ENTRY' || errno === 1062;
}

// ---------------------------------------------------------------------------- creating tickets

/**
 * Allocates the next ticket number and inserts the ticket in one statement.
 *
 * The number is derived from the table (`MAX(number) + 1`) inside the INSERT itself rather than
 * read into the application and written back, so there is no window between the read and the
 * write and no counter in memory that a second serverless instance would not share. Two
 * concurrent inserts can still compute the same MAX, which is what the unique index on
 * `number` is for: the loser gets a duplicate-key error and simply tries again with the new
 * MAX. Three attempts is plenty for a class project's traffic, and failing loudly after that
 * is better than handing out a duplicate number.
 */
async function insertTicketWithNumber(row: {
  subject: string;
  userId: number | null;
  customerName: string;
  customerEmail: string;
  status: TicketStatus;
}): Promise<{ ticketId: number; number: number }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = (await db.execute(sql`
        INSERT INTO ${tickets} (number, subject, user_id, customer_name, customer_email, status)
        SELECT COALESCE(MAX(${tickets.number}), ${TICKET_NUMBER_BASE}) + 1,
               ${row.subject}, ${row.userId}, ${row.customerName}, ${row.customerEmail}, ${row.status}
          FROM ${tickets}
      `)) as unknown as [{ insertId: number }];
      const ticketId = Number(result[0]?.insertId);
      if (!Number.isInteger(ticketId) || ticketId <= 0) throw new Error('ticket insert returned no id');
      const [created] = await db.select({ number: tickets.number }).from(tickets).where(eq(tickets.ticketId, ticketId));
      return { ticketId, number: created?.number ?? 0 };
    } catch (err) {
      if (isDuplicateKeyError(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new ConflictError('Could not allocate a ticket number. Please try again.');
}

/** Opens a ticket from the footer contact form and emails the customer the number. */
export async function createTicketFromContactForm(input: NewTicketInput, userId: number | null) {
  if (input.website) throw new BadRequestError('Invalid inquiry submission');
  const { ticketId, number } = await insertTicketWithNumber({
    subject: input.subject,
    userId,
    customerName: input.name,
    customerEmail: input.email,
    status: 'open',
  });
  await db.insert(ticketMessages).values({
    ticketId,
    direction: 'in',
    fromEmail: input.email,
    body: input.message,
    // Our own id for a message that did not arrive by email, so a later inbound reply that
    // quotes it in References still threads, and so the unique index has something to hold.
    messageId: `form-${ticketId}-${Date.now()}@bookwrms.store`,
  });
  await sendEmail(ticketReceivedEmail(input.email, input.name, number, input.subject));
  return { ticketId, number };
}

/**
 * Opens a ticket (or a mailbox entry) for an email that did not thread onto an existing one.
 * Machine traffic is parked as `closed` so it lands in the Mailbox tab instead of the queue;
 * see listMailbox() for why that is the marker.
 */
export async function createTicketFromEmail(mail: {
  subject: string;
  fromEmail: string;
  fromName: string;
  body: string;
  messageId: string;
  inReplyTo: string | null;
  machine: boolean;
}) {
  const [existingUser] = await db.select({ userId: users.userId }).from(users).where(eq(users.email, mail.fromEmail));
  const { ticketId, number } = await insertTicketWithNumber({
    subject: mail.subject,
    userId: existingUser?.userId ?? null,
    customerName: mail.fromName,
    customerEmail: mail.fromEmail,
    status: mail.machine ? 'closed' : 'open',
  });
  const stored = await appendInboundMessage(ticketId, mail);
  return { ticketId, number, stored };
}

// ---------------------------------------------------------------------------- thread messages

/**
 * Appends an inbound email to a thread, skipping it if we already have it.
 *
 * Returns false when the message was already stored. Dedupe is the unique index on
 * `message_id`, checked first to save the work and then caught on insert, which is what makes
 * two syncs running at once safe: whichever loses the race sees the duplicate and stops.
 */
export async function appendInboundMessage(
  ticketId: number,
  mail: { fromEmail: string; body: string; messageId: string; inReplyTo: string | null }
): Promise<boolean> {
  const [already] = await db
    .select({ id: ticketMessages.ticketMessageId })
    .from(ticketMessages)
    .where(eq(ticketMessages.messageId, mail.messageId));
  if (already) return false;
  try {
    await db.insert(ticketMessages).values({
      ticketId,
      direction: 'in',
      fromEmail: mail.fromEmail,
      body: mail.body,
      messageId: mail.messageId,
      inReplyTo: mail.inReplyTo,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
  // A customer who writes back re-opens a thread staff had set aside, but a thread they
  // deliberately closed stays closed (that is what the Mailbox relies on).
  await db
    .update(tickets)
    .set({ status: 'open' })
    .where(and(eq(tickets.ticketId, ticketId), eq(tickets.status, 'pending')));
  return true;
}

/**
 * Builds the lookup the pure matcher needs, restricted to the ids the inbound email actually
 * mentions. Nothing more is loaded, so this stays a small indexed query however big the
 * mailbox gets.
 */
export async function buildThreadLookup(candidateMessageIds: string[], ticketNumber: number | null): Promise<ThreadLookup> {
  const byMessageId = new Map<string, number>();
  if (candidateMessageIds.length) {
    const rows = await db
      .select({ messageId: ticketMessages.messageId, ticketId: ticketMessages.ticketId })
      .from(ticketMessages)
      .where(inArray(ticketMessages.messageId, candidateMessageIds));
    for (const r of rows) if (r.messageId) byMessageId.set(r.messageId, r.ticketId);
  }

  const byTicketNumber = new Map<number, number>();
  if (ticketNumber !== null) {
    const rows = await db
      .select({ number: tickets.number, ticketId: tickets.ticketId })
      .from(tickets)
      .where(eq(tickets.number, ticketNumber));
    for (const r of rows) byTicketNumber.set(r.number, r.ticketId);
  }

  return { byMessageId, byTicketNumber };
}

// ---------------------------------------------------------------------------- reading tickets

function statusCondition(status: TicketListQuery['status']) {
  if (!status || status === 'unresolved') return inArray(tickets.status, ['open', 'pending']);
  if (status === 'all') return undefined;
  return eq(tickets.status, status);
}

/** The ticket queue. Mailbox entries (machine mail parked as closed) are filtered out. */
export async function listTickets(query: TicketListQuery) {
  const conditions = [];
  const status = statusCondition(query.status);
  if (status) conditions.push(status);
  if (query.assignedTo === 'unassigned') conditions.push(isNull(tickets.assignedTo));
  else if (typeof query.assignedTo === 'number') conditions.push(eq(tickets.assignedTo, query.assignedTo));
  if (query.q) {
    const like = `%${query.q}%`;
    // Bound parameters, so a search term with a quote or a percent sign is just text.
    conditions.push(or(sql`${tickets.subject} LIKE ${like}`, sql`${tickets.customerEmail} LIKE ${like}`));
  }

  const rows = await db
    .select({
      ticketId: tickets.ticketId,
      number: tickets.number,
      subject: tickets.subject,
      customerName: tickets.customerName,
      customerEmail: tickets.customerEmail,
      status: tickets.status,
      assignedTo: tickets.assignedTo,
      assigneeName: sql<string | null>`CONCAT(${admin.firstName}, ' ', ${admin.lastName})`,
      created: tickets.created,
      updated: tickets.updated,
      messageCount: sql<number>`(SELECT COUNT(*) FROM ${ticketMessages} WHERE ${ticketMessages.ticketId} = ${tickets.ticketId})`,
    })
    .from(tickets)
    .leftJoin(admin, eq(admin.adminId, tickets.assignedTo))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(tickets.updated))
    .limit(query.limit ?? 100);

  // A closed machine-mail row belongs to the Mailbox tab, not the queue.
  return rows
    .map((r) => ({ ...r, messageCount: Number(r.messageCount ?? 0) }))
    .filter((r) => !(r.status === 'closed' && r.assignedTo === null && isMachineMail({ subject: r.subject, fromEmail: r.customerEmail })));
}

/** One thread, with its messages oldest first. */
export async function getTicket(ticketId: number) {
  const [row] = await db
    .select({
      ticket: tickets,
      assigneeName: sql<string | null>`CONCAT(${admin.firstName}, ' ', ${admin.lastName})`,
    })
    .from(tickets)
    .leftJoin(admin, eq(admin.adminId, tickets.assignedTo))
    .where(eq(tickets.ticketId, ticketId));
  if (!row) throw new NotFoundError('Ticket not found');

  const messages = await db
    .select({
      ticketMessageId: ticketMessages.ticketMessageId,
      direction: ticketMessages.direction,
      fromEmail: ticketMessages.fromEmail,
      body: ticketMessages.body,
      created: ticketMessages.created,
      staffId: ticketMessages.staffId,
      staffName: sql<string | null>`CONCAT(${admin.firstName}, ' ', ${admin.lastName})`,
    })
    .from(ticketMessages)
    .leftJoin(admin, eq(admin.adminId, ticketMessages.staffId))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.created), asc(ticketMessages.ticketMessageId));

  return { ...row.ticket, assigneeName: row.assigneeName, messages };
}

/** Counts for the sidebar badge and the inbox tabs. */
export async function ticketCounts() {
  const [row] = await db
    .select({
      open: sql<number>`SUM(${tickets.status} = 'open')`,
      unresolved: sql<number>`SUM(${tickets.status} IN ('open', 'pending'))`,
      unassigned: sql<number>`SUM(${tickets.status} IN ('open', 'pending') AND ${tickets.assignedTo} IS NULL)`,
    })
    .from(tickets);
  return {
    open: Number(row?.open ?? 0),
    unresolved: Number(row?.unresolved ?? 0),
    unassigned: Number(row?.unassigned ?? 0),
  };
}

/** Staff who can be assigned a ticket: anyone active who may answer messages. */
export async function assignableStaff() {
  return db
    .select({ adminId: admin.adminId, firstName: admin.firstName, lastName: admin.lastName, role: admin.adminRole })
    .from(admin)
    .where(eq(admin.isActive, true))
    .orderBy(asc(admin.firstName), asc(admin.lastName));
}

// ---------------------------------------------------------------------------- changing tickets

export async function setTicketStatus(ticketId: number, status: TicketStatus) {
  const [existing] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.ticketId, ticketId));
  if (!existing) throw new NotFoundError('Ticket not found');
  await db.update(tickets).set({ status }).where(eq(tickets.ticketId, ticketId));
  return { status };
}

/**
 * Assigns a ticket. The caller decides whether this staff member may assign to somebody else;
 * this only checks that the target exists and is active, so a stale id cannot be stored.
 */
export async function assignTicket(ticketId: number, assignedTo: number | null) {
  const [existing] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.ticketId, ticketId));
  if (!existing) throw new NotFoundError('Ticket not found');
  if (assignedTo !== null) {
    const [target] = await db
      .select({ id: admin.adminId })
      .from(admin)
      .where(and(eq(admin.adminId, assignedTo), eq(admin.isActive, true)));
    if (!target) throw new NotFoundError('That staff member does not exist');
  }
  await db.update(tickets).set({ assignedTo }).where(eq(tickets.ticketId, ticketId));
  return { assignedTo };
}

/**
 * Emails a staff reply from support@ and appends it to the thread.
 *
 * The reply is stored whether or not SMTP accepted it, so a mail outage never loses what a
 * staff member wrote; `emailed` tells the portal which happened. The Message-ID we sent under
 * is stored too, which is the whole basis of threading the customer's answer back.
 */
export async function replyToTicket(staffId: number, ticketId: number, body: string) {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.ticketId, ticketId));
  if (!ticket) throw new NotFoundError('Ticket not found');

  // The whole thread, oldest first. The last one is what this reply answers (In-Reply-To) and
  // the rest are its ancestors, which together make a proper References chain. There is no
  // column holding the chain as it arrived, so rebuilding it from our own rows is the most
  // complete version we can send.
  const thread = await db
    .select({ messageId: ticketMessages.messageId })
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(asc(ticketMessages.created), asc(ticketMessages.ticketMessageId));
  const chain = thread.map((m) => m.messageId).filter((id): id is string => !!id);
  const parentMessageId = chain.length ? chain[chain.length - 1] : null;

  const messageId = newOutboundMessageId();
  const replySubject = buildReplySubject(ticket.number, ticket.subject);
  // buildReferences dedupes and caps the chain, so a long thread cannot grow the header without bound.
  const references = buildReferences(chain.map((id) => `<${id}>`).join(' '), parentMessageId);

  const { emailed } = await sendThreadedEmail(
    ticketReplyEmail(ticket.customerEmail, { replySubject, ticketNumber: ticket.number, body }),
    { messageId, inReplyTo: parentMessageId, references }
  );

  await db.insert(ticketMessages).values({
    ticketId,
    direction: 'out',
    fromEmail: process.env.SUPPORT_EMAIL ?? 'support@bookwrms.store',
    body,
    messageId,
    inReplyTo: parentMessageId,
    staffId,
  });
  // Answered and waiting on the customer.
  await db.update(tickets).set({ status: 'pending' }).where(eq(tickets.ticketId, ticketId));

  return { emailed, email: ticket.customerEmail, number: ticket.number };
}

// ---------------------------------------------------------------------------- mailbox

/**
 * Mail that arrived at support@ and is not a customer conversation: DMARC and TLS reports,
 * bounces, auto-replies.
 *
 * There is no separate table for these in the schema and none may be added, so they are stored
 * as tickets that are `closed` and unassigned, and recognised on read by the same pure
 * classifier that parked them. That keeps them out of the queue while losing nothing.
 *
 * Two consequences worth knowing: the filter runs in JavaScript over a fixed scan window
 * (MAILBOX_SCAN_LIMIT) rather than in SQL, so this tab is not paginated beyond that window;
 * and a genuine ticket that staff close while it is unassigned AND whose subject or sender
 * looks like machine mail would show up here. Converting it is one click, and nothing is lost
 * either way.
 */
export async function listMailbox(limit = 100) {
  const rows = await db
    .select({
      ticketId: tickets.ticketId,
      number: tickets.number,
      subject: tickets.subject,
      customerName: tickets.customerName,
      customerEmail: tickets.customerEmail,
      created: tickets.created,
    })
    .from(tickets)
    .where(and(eq(tickets.status, 'closed'), isNull(tickets.assignedTo)))
    .orderBy(desc(tickets.created))
    .limit(MAILBOX_SCAN_LIMIT);

  return rows
    .filter((r) => isMachineMail({ subject: r.subject, fromEmail: r.customerEmail }))
    .slice(0, limit);
}

/** "Convert to ticket": re-opens a mailbox entry so it joins the queue. */
export async function convertMailboxEntryToTicket(ticketId: number) {
  const [row] = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.ticketId, ticketId));
  if (!row) throw new NotFoundError('Mailbox entry not found');
  await db.update(tickets).set({ status: 'open' }).where(eq(tickets.ticketId, ticketId));
  return { ticketId };
}
