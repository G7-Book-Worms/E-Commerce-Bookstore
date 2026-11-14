// POST /api/contact: the footer "Contact Support" form (SCRUM-207). Saved for the staff inbox.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { contactSchema, createContactMessage } from '@/server/src/modules/contact/contact-service';
import { createTicketFromContactForm } from '@/server/src/modules/tickets/ticket-service';
import { logActivity } from '@/server/src/modules/activity/activity-log';

/**
 * The footer form has no subject field, so one is derived from the opening of the message -
 * the first line, or the first sentence's worth of it. Tickets require a subject because it is
 * what carries the `[Ticket #n]` token in the email thread.
 */
function subjectFromMessage(message: string): string {
  const firstLine = message.split(/\r?\n/, 1)[0].trim();
  const candidate = (firstLine.length >= 3 ? firstLine : message.trim()).slice(0, 80).trim();
  return candidate.length >= 3 ? candidate : 'Support request';
}

export const POST = createApiHandler(async (req: NextRequest) => {
  const ip = clientIp(req);
  await rateLimit(`contact:ip:${ip}`, 5, 60 * 60);
  const input = contactSchema.parse(await req.json());
  const userId = await authenticateRequest(req).then((r) => Number(r.user.id)).catch(() => null);
  const messageId = await createContactMessage(input, userId);

  // The staff inbox reads tickets now, so the form opens one as well. contact_messages is still
  // written so the Session 3 inbox and its demo data keep working during the changeover.
  // A ticket failure must not lose the customer's message, which is already saved above.
  let ticketNumber: number | null = null;
  try {
    const ticket = await createTicketFromContactForm(
      { ...input, subject: subjectFromMessage(input.message) },
      userId
    );
    ticketNumber = ticket.number;
  } catch (err) {
    console.error('[contact] message saved but ticket creation failed', err);
  }

  await logActivity(
    userId ? 'customer' : 'system',
    userId,
    'message.received',
    { messageId, ticketNumber, email: input.email },
    ip
  );
  return HttpResponse.success(
    { messageId, ticketNumber },
    "Thanks for contacting Book Worms! We'll reply by email from support@bookwrms.store."
  );
});
