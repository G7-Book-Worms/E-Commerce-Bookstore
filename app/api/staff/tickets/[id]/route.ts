// One ticket: read the thread, reply to it, change its status, assign it.
//
// Every method goes through staffApi() with an explicit permission, so a role that lacks
// 'messages.view' gets a 403 rather than a thread, whether or not it guessed a real id. The id
// itself is validated by ticketIdParam() before it reaches a query.
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { BadRequestError, ForbiddenError } from '@/server/src/shared/errors/app-error';
import { can } from '@/lib/staff-permissions';
import {
  assignTicket,
  getTicket,
  replyToTicket,
  setTicketStatus,
} from '@/server/src/modules/tickets/ticket-service';
import {
  ticketAssignSchema,
  ticketIdParam,
  ticketReplySchema,
  ticketStatusSchema,
} from '@/server/src/modules/tickets/ticket-schema';

// GET /api/staff/tickets/:id -> the ticket and its messages, oldest first
export const GET = staffApi('messages.view', async (_req, { params }) => {
  const ticket = await getTicket(ticketIdParam(params.id));
  return HttpResponse.success(ticket, 'Ticket loaded');
});

// POST /api/staff/tickets/:id { body } -> emails the reply from support@ and appends it
export const POST = staffApi('messages.reply', async (req, { params, staff, log }) => {
  const id = ticketIdParam(params.id);
  const { body } = ticketReplySchema.parse(await req.json());
  const result = await replyToTicket(staff.id, id, body);
  // The reply text itself is correspondence and is not written to the activity log.
  await log('ticket.replied', { ticketId: id, number: result.number, emailed: result.emailed });
  return HttpResponse.success(
    result,
    result.emailed ? 'Reply sent' : 'Reply saved to the thread (email is not configured here)'
  );
});

/**
 * PATCH /api/staff/tickets/:id { status } | { assignedTo }
 *
 * Assignment is split by role on purpose. An employee answers tickets, so they may take one
 * for themselves, but moving work onto somebody else is a supervisory act, so it needs the
 * permission that already marks a supervisor ('staff.manage', held by manager and above).
 * lib/staff-permissions.ts has no messages.assign and must not be edited, so this reuses the
 * closest existing permission rather than inventing one.
 */
export const PATCH = staffApi('messages.reply', async (req, { params, staff, log }) => {
  const id = ticketIdParam(params.id);
  const payload = await req.json();

  if (payload && typeof payload === 'object' && 'assignedTo' in payload) {
    const { assignedTo } = ticketAssignSchema.parse(payload);
    const toSomeoneElse = assignedTo !== null && assignedTo !== staff.id;
    if (toSomeoneElse && !can(staff.role, 'staff.manage')) {
      throw new ForbiddenError('Your role can only assign tickets to yourself');
    }
    const result = await assignTicket(id, assignedTo);
    await log('ticket.assigned', { ticketId: id, assignedTo });
    return HttpResponse.success(result, assignedTo === null ? 'Unassigned' : 'Assigned');
  }

  if (payload && typeof payload === 'object' && 'status' in payload) {
    const { status } = ticketStatusSchema.parse(payload);
    const result = await setTicketStatus(id, status);
    await log('ticket.status_changed', { ticketId: id, status });
    return HttpResponse.success(result, 'Saved');
  }

  throw new BadRequestError('Send either a status or an assignedTo');
});
