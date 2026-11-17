// Which accounts are locked out of signing in right now, for the administrators' "Locked
// Accounts" panel on the dashboard. A lock is a rate_limits row with locked_until in the future,
// keyed by the account's email (wrong passwords) or id (wrong sign-in codes); see
// shared/security/lock-keys.ts. Locks on emails that have no account are left out: there is
// nobody to unlock, and they expire by themselves.
import { inArray, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { admin, rateLimits, users } from '../../../db/schema';

export interface LockedAccount {
  kind: 'customer' | 'staff';
  id: number;
  name: string;
  email: string;
  role?: string;
  lockedUntil: Date;
}

export async function listLockedAccounts(): Promise<LockedAccount[]> {
  const rows = await db
    .select({ key: rateLimits.rateKey, until: rateLimits.lockedUntil })
    .from(rateLimits)
    .where(sql`${rateLimits.lockedUntil} > CURRENT_TIMESTAMP`);

  const customerEmails = new Map<string, Date>(), staffEmails = new Map<string, Date>();
  const customerIds = new Map<number, Date>(), staffIds = new Map<number, Date>();
  for (const r of rows) {
    if (!r.until) continue;
    const until = new Date(r.until);
    let m: RegExpMatchArray | null;
    if ((m = r.key.match(/^login:email:(.+)$/))) customerEmails.set(m[1], until);
    else if ((m = r.key.match(/^staff-login:email:(.+)$/))) staffEmails.set(m[1], until);
    else if ((m = r.key.match(/^mfa:customer:(\d+)$/))) customerIds.set(Number(m[1]), until);
    else if ((m = r.key.match(/^mfa:admin:(\d+)$/))) staffIds.set(Number(m[1]), until);
  }

  const [customers, staff] = await Promise.all([
    customerEmails.size || customerIds.size
      ? db.select({ id: users.userId, first: users.firstName, last: users.lastName, email: users.email }).from(users)
          .where(sql`${customerEmails.size ? inArray(users.email, [...customerEmails.keys()]) : sql`FALSE`} OR ${customerIds.size ? inArray(users.userId, [...customerIds.keys()]) : sql`FALSE`}`)
      : Promise.resolve([]),
    staffEmails.size || staffIds.size
      ? db.select({ id: admin.adminId, first: admin.firstName, last: admin.lastName, email: admin.email, role: admin.adminRole }).from(admin)
          .where(sql`${staffEmails.size ? inArray(admin.email, [...staffEmails.keys()]) : sql`FALSE`} OR ${staffIds.size ? inArray(admin.adminId, [...staffIds.keys()]) : sql`FALSE`}`)
      : Promise.resolve([]),
  ]);

  const latest = (...d: (Date | undefined)[]) => new Date(Math.max(...d.filter((x): x is Date => !!x).map((x) => x.getTime())));
  const out: LockedAccount[] = [
    ...customers.map((u) => ({
      kind: 'customer' as const, id: u.id, name: `${u.first} ${u.last}`, email: u.email,
      lockedUntil: latest(customerEmails.get(u.email.toLowerCase()), customerIds.get(u.id)),
    })),
    ...staff.map((a) => ({
      kind: 'staff' as const, id: a.id, name: `${a.first} ${a.last}`, email: a.email, role: a.role,
      lockedUntil: latest(staffEmails.get(a.email.toLowerCase()), staffIds.get(a.id)),
    })),
  ];
  return out.sort((a, b) => a.lockedUntil.getTime() - b.lockedUntil.getTime());
}
