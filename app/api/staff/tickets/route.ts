// GET /api/staff/tickets - the ticket queue, filtered.
// Reading a ticket needs 'messages.view': the permission is checked, not just the session, so a
// role without it cannot reach a ticket by guessing an id either (see [id]/route.ts).
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { listTickets } from '@/server/src/modules/tickets/ticket-service';
import { ticketListQuerySchema } from '@/server/src/modules/tickets/ticket-schema';

export const GET = staffApi('messages.view', async (req) => {
  // Every query parameter is validated, including the ones that reach a WHERE clause.
  const query = ticketListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await listTickets(query);
  return HttpResponse.success(rows, 'Tickets loaded');
});
