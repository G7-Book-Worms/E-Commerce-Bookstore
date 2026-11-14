// POST /api/staff/tickets/sync - pull new mail from support@ on demand.
//
// This is the endpoint a scheduled job calls as well as the inbox's "Check mail now" button.
// It goes through staffApi() with an explicit permission like every other staff route, which
// means a cron has to present a staff session cookie; it is deliberately NOT an unauthenticated
// secret-token endpoint, because the project's rule is that every staff API route is permission
// checked. A scheduled job running inside the app can instead call syncSupportMailbox() from
// server/src/modules/tickets/mail-sync.ts directly and skip HTTP altogether.
//
// Running it twice at once is safe: concurrent calls in one process share a single run, and
// across processes the unique index on ticket_messages.message_id stops any duplication.
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { syncSupportMailbox } from '@/server/src/modules/tickets/mail-sync';

export const POST = staffApi('messages.view', async (_req, { log }) => {
  const result = await syncSupportMailbox();
  if (result.stored) await log('mail.sync_requested', { stored: result.stored, newTickets: result.newTickets });
  const message =
    result.status === 'skipped' && result.reason === 'not-configured'
      ? 'Mail sync is not configured here (SUPPORT_EMAIL / SUPPORT_EMAIL_PASSWORD are unset)'
      : result.status === 'error'
        ? 'Could not reach the support mailbox'
        : result.stored
          ? `Synced ${result.stored} new message${result.stored === 1 ? '' : 's'}`
          : 'No new mail';
  return HttpResponse.success(result, message);
});
