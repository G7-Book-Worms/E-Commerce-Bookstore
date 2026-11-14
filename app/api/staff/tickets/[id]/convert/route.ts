// POST /api/staff/tickets/:id/convert - "convert to ticket" on a Mailbox entry.
// Re-opens a message that the classifier parked as machine mail, so it joins the queue.
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { convertMailboxEntryToTicket } from '@/server/src/modules/tickets/ticket-service';
import { ticketIdParam } from '@/server/src/modules/tickets/ticket-schema';

export const POST = staffApi('messages.reply', async (_req, { params, log }) => {
  const id = ticketIdParam(params.id);
  const result = await convertMailboxEntryToTicket(id);
  await log('mailbox.converted_to_ticket', { ticketId: id });
  return HttpResponse.success(result, 'Moved to the ticket queue');
});
