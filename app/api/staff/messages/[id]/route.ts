import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { messageStatusSchema, replySchema, replyToMessage, setMessageStatus } from '@/server/src/modules/contact/contact-service';

// POST /api/staff/messages/:id { reply } -> emails the reply from support@ and marks it replied
export const POST = staffApi('messages.reply', async (req, { params, log, staff }) => {
  const id = idParam(params.id);
  const { reply } = replySchema.parse(await req.json());
  const result = await replyToMessage(staff.id, id, reply);
  await log('message.replied', { messageId: id, email: result.email, emailed: result.emailed });
  return HttpResponse.success(result, result.emailed ? 'Reply sent' : 'Reply saved (email is not configured here)');
});

// PATCH /api/staff/messages/:id { status }
export const PATCH = staffApi('messages.reply', async (req, { params, log }) => {
  const id = idParam(params.id);
  const { status } = messageStatusSchema.parse(await req.json());
  await setMessageStatus(id, status);
  await log('message.status_changed', { messageId: id, status });
  return HttpResponse.success({ status }, 'Saved');
});
