// PATCH /api/staff/tickets/alerts - mark one alert read, or all of them.
// Alerts are staff_notifications rows (low stock, sold out), shown on the Alerts tab.
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { BadRequestError } from '@/server/src/shared/errors/app-error';
import { markAllNotificationsRead, markNotificationRead } from '@/server/src/modules/tickets/notification-service';
import { notificationReadSchema } from '@/server/src/modules/tickets/ticket-schema';

export const PATCH = staffApi('messages.reply', async (req, { log }) => {
  const { notificationId, all } = notificationReadSchema.parse(await req.json());
  if (all) {
    const result = await markAllNotificationsRead();
    await log('alerts.marked_all_read');
    return HttpResponse.success(result, 'All alerts marked read');
  }
  if (notificationId === undefined) throw new BadRequestError('Send a notificationId, or all: true');
  const result = await markNotificationRead(notificationId);
  await log('alert.marked_read', { notificationId });
  return HttpResponse.success(result, 'Marked read');
});
