// Activity log page (SCRUM-190): every customer, staff and system action, filterable by category,
// who did it, text and date range. Read-only: nothing here (or anywhere in the portal) edits or
// deletes an entry.
import { and, asc, desc, eq, gte, inArray, like, lt, notInArray, notLike, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../../../db';
import { activityLog, admin, users } from '../../../db/schema';
import {
  ACTIVITY_CATEGORIES,
  categorizeAction,
  categoryFilterSpec,
  likePrefix,
  type ActivityCategory,
} from '../../../../lib/activity-categories';
import { activityDateRange, type ActivityFilters } from '../../../../lib/activity-filters';

export const ACTIVITY_PAGE_SIZE = 50;

/** SQL for "this entry's action is in `category`", built from the same rules as describeAction(). */
export function categoryCondition(category: ActivityCategory): SQL | undefined {
  const spec = categoryFilterSpec(category);
  const byPrefix = spec.prefixes.length
    ? or(...spec.prefixes.map((p) => like(activityLog.action, likePrefix(p))))
    : and(...spec.excludePrefixes.map((p) => notLike(activityLog.action, likePrefix(p))));
  const unknownByPrefix = and(notInArray(activityLog.action, spec.knownActions), byPrefix);
  return spec.exact.length ? or(inArray(activityLog.action, spec.exact), unknownByPrefix) : unknownByPrefix;
}

/** Every filter except category (the category chips count across those). */
function baseConditions(f: Omit<ActivityFilters, 'page' | 'sort' | 'category'>): SQL[] {
  const conds: SQL[] = [];
  if (f.actor) conds.push(eq(activityLog.actorType, f.actor));
  if (f.q) {
    const pattern = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const text = or(
      like(activityLog.action, pattern),
      like(sql`CAST(${activityLog.details} AS CHAR)`, pattern),
      like(activityLog.ip, pattern),
      like(users.email, pattern),
      like(admin.email, pattern),
    );
    if (text) conds.push(text);
  }
  const { start, end } = activityDateRange(f);
  if (start) conds.push(gte(activityLog.created, start));
  if (end) conds.push(lt(activityLog.created, end));
  return conds;
}

export async function listActivity(f: ActivityFilters) {
  const base = baseConditions(f);
  const conds = f.category ? [...base, categoryCondition(f.category)].filter((c): c is SQL => !!c) : base;
  const where = conds.length ? and(...conds) : undefined;
  const baseWhere = base.length ? and(...base) : undefined;
  const page = Math.max(1, f.page);
  const order = f.sort === 'oldest' ? asc : desc;

  const actorName = sql<string | null>`CASE
    WHEN ${activityLog.actorType} = 'customer' THEN CONCAT(${users.firstName}, ' ', ${users.lastName})
    WHEN ${activityLog.actorType} = 'admin' THEN CONCAT(${admin.firstName}, ' ', ${admin.lastName})
    ELSE NULL END`;
  const actorEmail = sql<string | null>`CASE
    WHEN ${activityLog.actorType} = 'customer' THEN ${users.email}
    WHEN ${activityLog.actorType} = 'admin' THEN ${admin.email}
    ELSE NULL END`;
  const customerJoin = and(eq(activityLog.actorType, 'customer'), eq(users.userId, activityLog.actorId));
  const adminJoin = and(eq(activityLog.actorType, 'admin'), eq(admin.adminId, activityLog.actorId));

  const [rows, [{ total }], byAction] = await Promise.all([
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
      .leftJoin(users, customerJoin)
      .leftJoin(admin, adminJoin)
      .where(where)
      .orderBy(order(activityLog.created), order(activityLog.activityId))
      .limit(ACTIVITY_PAGE_SIZE)
      .offset((page - 1) * ACTIVITY_PAGE_SIZE),
    db.select({ total: sql<number>`COUNT(*)` })
      .from(activityLog)
      .leftJoin(users, customerJoin)
      .leftJoin(admin, adminJoin)
      .where(where),
    // One row per distinct action (a few dozen), grouped into categories in JS for the chip counts.
    db.select({ action: activityLog.action, n: sql<number>`COUNT(*)` })
      .from(activityLog)
      .leftJoin(users, customerJoin)
      .leftJoin(admin, adminJoin)
      .where(baseWhere)
      .groupBy(activityLog.action),
  ]);

  const counts = Object.fromEntries(ACTIVITY_CATEGORIES.map((c) => [c, 0])) as Record<ActivityCategory, number>;
  let allCount = 0;
  for (const r of byAction) {
    counts[categorizeAction(r.action)] += Number(r.n);
    allCount += Number(r.n);
  }

  return { rows, total: Number(total), page, pageSize: ACTIVITY_PAGE_SIZE, counts, allCount };
}

/** The latest few Security entries, for the dashboard card. */
export async function recentSecurityEvents(limit = 5) {
  return db.select({
    activityId: activityLog.activityId,
    created: activityLog.created,
    actorType: activityLog.actorType,
    action: activityLog.action,
    ip: activityLog.ip,
  })
    .from(activityLog)
    .where(categoryCondition('security'))
    .orderBy(desc(activityLog.created), desc(activityLog.activityId))
    .limit(limit);
}
