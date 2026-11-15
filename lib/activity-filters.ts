// Reads the activity log's query string (?category=&actor=&q=&from=&to=&sort=&page=) into values the
// query can trust. Anything not on a whitelist is dropped, so a hand-edited URL just shows everything.
import { isActivityCategory, type ActivityCategory } from './activity-categories';

export type ActivityActor = 'customer' | 'admin' | 'system';
export type ActivitySort = 'newest' | 'oldest';

export type ActivityFilters = {
  category?: ActivityCategory;
  actor?: ActivityActor;
  q?: string;
  /** yyyy-mm-dd, a day in the store's time zone (America/Chicago). */
  from?: string;
  to?: string;
  sort: ActivitySort;
  page: number;
};

export const ACTIVITY_ACTORS: readonly ActivityActor[] = ['customer', 'admin', 'system'];
export const MAX_ACTIVITY_SEARCH = 100;
const MAX_PAGE = 10_000;
export const STORE_TIME_ZONE = 'America/Chicago';

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < 2000 || y > 2100) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parseActivityFilters(raw: RawParams): ActivityFilters {
  const category = one(raw.category);
  const actor = one(raw.actor);
  const q = one(raw.q)?.trim().slice(0, MAX_ACTIVITY_SEARCH);
  let from = one(raw.from);
  let to = one(raw.to);
  if (!isValidDay(from)) from = undefined;
  if (!isValidDay(to)) to = undefined;
  // A backwards range is almost always the two boxes filled the wrong way round.
  if (from && to && from > to) [from, to] = [to, from];
  const pageNum = Number(one(raw.page));
  const page = Number.isInteger(pageNum) && pageNum >= 1 ? Math.min(pageNum, MAX_PAGE) : 1;
  return {
    category: isActivityCategory(category) ? category : undefined,
    actor: ACTIVITY_ACTORS.includes(actor as ActivityActor) ? (actor as ActivityActor) : undefined,
    q: q || undefined,
    from,
    to,
    sort: one(raw.sort) === 'oldest' ? 'oldest' : 'newest',
    page,
  };
}

/** The filters as query-string values (for links and the pager); defaults are left out. */
export function activityFilterParams(f: ActivityFilters): Record<string, string | undefined> {
  return {
    category: f.category,
    actor: f.actor,
    q: f.q,
    from: f.from,
    to: f.to,
    sort: f.sort === 'oldest' ? 'oldest' : undefined,
  };
}

/** Offset of `timeZone` from UTC at `at`, in minutes (e.g. -300 for Chicago in summer). */
function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant a store-time-zone day starts, e.g. "2026-11-14" -> 2026-11-14T06:00:00Z. */
export function startOfStoreDay(day: string, timeZone = STORE_TIME_ZONE): Date {
  const [y, m, d] = day.split('-').map(Number);
  const midnightUtc = Date.UTC(y, m - 1, d);
  // Twice, so a day that starts just after a daylight-saving change gets that day's offset.
  let offset = zoneOffsetMinutes(new Date(midnightUtc), timeZone);
  offset = zoneOffsetMinutes(new Date(midnightUtc - offset * 60_000), timeZone);
  return new Date(midnightUtc - offset * 60_000);
}

/** [start, end) instants for the from/to days; `to` includes the whole of that day. */
export function activityDateRange(f: Pick<ActivityFilters, 'from' | 'to'>, timeZone = STORE_TIME_ZONE) {
  let end: Date | undefined;
  if (f.to) {
    const [y, m, d] = f.to.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    end = startOfStoreDay(next, timeZone);
  }
  return { start: f.from ? startOfStoreDay(f.from, timeZone) : undefined, end };
}
