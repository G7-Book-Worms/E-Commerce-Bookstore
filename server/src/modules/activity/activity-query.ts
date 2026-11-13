// Activity log page (SCRUM-190): every customer, staff and system action, newest first.
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { activityLog, admin, users } from '../../../db/schema';

export const ACTIVITY_PAGE_SIZE = 50;

export async function listActivity(opts: { actor?: string; q?: string; page?: number }) {
  const conds = [];
  if (opts.actor === 'customer' || opts.actor === 'admin' || opts.actor === 'system') {
    conds.push(eq(activityLog.actorType, opts.actor));
  }
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(sql`(${activityLog.action} LIKE ${like} OR CAST(${activityLog.details} AS CHAR) LIKE ${like} OR ${activityLog.ip} LIKE ${like} OR ${users.email} LIKE ${like} OR ${admin.email} LIKE ${like})`);
  }
  const page = Math.max(1, opts.page ?? 1);
  const where = conds.length ? and(...conds) : undefined;
  const actorName = sql<string | null>`CASE
    WHEN ${activityLog.actorType} = 'customer' THEN CONCAT(${users.firstName}, ' ', ${users.lastName})
    WHEN ${activityLog.actorType} = 'admin' THEN CONCAT(${admin.firstName}, ' ', ${admin.lastName})
    ELSE NULL END`;
  const actorEmail = sql<string | null>`CASE
    WHEN ${activityLog.actorType} = 'customer' THEN ${users.email}
    WHEN ${activityLog.actorType} = 'admin' THEN ${admin.email}
    ELSE NULL END`;
  const base = () =>
    db.select({
      activityId: activityLog.activityId,
      created: activityLog.created,
      actorType: activityLog.actorType,
      actorId: activityLog.actorId,
      action: activityLog.action,
      details: activityLog.details,
      ip: activityLog.ip,
      actorName,
      actorEmail,
    })
    .from(activityLog)
    .leftJoin(users, and(eq(activityLog.actorType, 'customer'), eq(users.userId, activityLog.actorId)))
    .leftJoin(admin, and(eq(activityLog.actorType, 'admin'), eq(admin.adminId, activityLog.actorId)));

  const [rows, [{ total }]] = await Promise.all([
    base().where(where).orderBy(desc(activityLog.created), desc(activityLog.activityId))
      .limit(ACTIVITY_PAGE_SIZE).offset((page - 1) * ACTIVITY_PAGE_SIZE),
    db.select({ total: sql<number>`COUNT(*)` }).from(activityLog)
      .leftJoin(users, and(eq(activityLog.actorType, 'customer'), eq(users.userId, activityLog.actorId)))
      .leftJoin(admin, and(eq(activityLog.actorType, 'admin'), eq(admin.adminId, activityLog.actorId)))
      .where(where),
  ]);
  return { rows, total: Number(total), page, pageSize: ACTIVITY_PAGE_SIZE };
}
