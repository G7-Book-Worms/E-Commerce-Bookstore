// Staff notifications: the Alerts tab in the staff inbox. These are the things the portal has
// to surface that are not customer messages - low stock, sold out. Until now they were only
// emailed to support@, so a staff member who saw the alert fire had nowhere to look for it and
// reasonably concluded it was a bug. alertLowStock() in ../inventory/inventory-service.ts now
// writes them here as well as sending the email.
import 'server-only';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { staffNotifications } from '../../../db/schema';
import { NotFoundError } from '../../shared/errors/app-error';

export type NotificationKind = 'low_stock' | 'sold_out';

/**
 * Records one alert. Like activity logging, this must never break the action it describes: a
 * failed insert is printed and swallowed, because a restock that succeeded should not be
 * reported as failed just because its alert could not be filed.
 */
export async function recordStaffNotification(entry: {
  kind: NotificationKind;
  title: string;
  body?: string | null;
  subjectType?: 'book' | 'order' | null;
  subjectId?: number | null;
}): Promise<void> {
  try {
    await db.insert(staffNotifications).values({
      kind: entry.kind,
      title: entry.title.slice(0, 200),
      body: entry.body ?? null,
      subjectType: entry.subjectType ?? null,
      subjectId: entry.subjectId ?? null,
    });
  } catch (err) {
    console.error('[staff-notifications] failed to record', entry.kind, err);
  }
}

export async function listNotifications(limit = 100) {
  return db
    .select()
    .from(staffNotifications)
    .orderBy(desc(staffNotifications.created))
    .limit(limit);
}

/** Unread count for the Alerts badge. */
export async function unreadNotificationCount(): Promise<number> {
  const [row] = await db
    .select({ unread: sql<number>`COUNT(*)` })
    .from(staffNotifications)
    .where(isNull(staffNotifications.readAt));
  return Number(row?.unread ?? 0);
}

export async function markNotificationRead(notificationId: number) {
  const [row] = await db
    .select({ id: staffNotifications.notificationId })
    .from(staffNotifications)
    .where(eq(staffNotifications.notificationId, notificationId));
  if (!row) throw new NotFoundError('Alert not found');
  await db
    .update(staffNotifications)
    .set({ readAt: new Date() })
    .where(eq(staffNotifications.notificationId, notificationId));
  return { notificationId };
}

export async function markAllNotificationsRead() {
  await db.update(staffNotifications).set({ readAt: new Date() }).where(isNull(staffNotifications.readAt));
  return { all: true };
}
