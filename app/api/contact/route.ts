// POST /api/contact: the footer "Contact Support" form (SCRUM-207). Saved for the staff inbox.
import { NextRequest } from 'next/server';
import { createApiHandler } from '@/server/src/server';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { clientIp } from '@/server/src/shared/security/client-ip';
import { rateLimit } from '@/server/src/shared/security/rate-limit';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { contactSchema, createContactMessage } from '@/server/src/modules/contact/contact-service';
import { logActivity } from '@/server/src/modules/activity/activity-log';

export const POST = createApiHandler(async (req: NextRequest) => {
  const ip = clientIp(req);
  await rateLimit(`contact:ip:${ip}`, 5, 60 * 60);
  const input = contactSchema.parse(await req.json());
  const userId = await authenticateRequest(req).then((r) => Number(r.user.id)).catch(() => null);
  const messageId = await createContactMessage(input, userId);
  await logActivity(userId ? 'customer' : 'system', userId, 'message.received', { messageId, email: input.email }, ip);
  return HttpResponse.success(
    { messageId },
    "Thanks for contacting Book Worms! We'll reply by email from support@bookwrms.store."
  );
});
