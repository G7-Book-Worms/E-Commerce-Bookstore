// server/src/modules/staff/staff-mailbox.ts
// Work mailboxes for staff (jane.doe@bookwrms.store), created and removed with their staff
// account, through the Migadu admin API (https://migadu.com/api/).
//
// We never handle the mailbox password: Migadu emails an invitation to the person's own address
// and they choose it there. Only the mailbox name (local part) is stored, in admin.work_mailbox,
// so deleting the staff account knows which mailbox to remove.
//
// Switched on by MIGADU_API_USER (the Migadu account email) and MIGADU_API_KEY; the domain is
// MAIL_DOMAIN (default bookwrms.store). Without them the staff page simply doesn't offer it.
// The API key is never logged.

const API = 'https://api.migadu.com/v1';

export function mailboxesEnabled(): boolean {
  return !!(process.env.MIGADU_API_USER && process.env.MIGADU_API_KEY);
}

export function mailDomain(): string {
  return (process.env.MAIL_DOMAIN || 'bookwrms.store').toLowerCase();
}

/** Names a staff mailbox may never take: shared or system addresses. */
export const RESERVED_LOCAL_PARTS = new Set([
  'support', 'no-reply', 'noreply', 'admin', 'administrator', 'postmaster', 'abuse', 'hostmaster',
  'webmaster', 'root', 'security', 'billing', 'info', 'sales', 'help', 'mailer-daemon', 'dmarc',
]);

/** "Zoë O'Brien-Smith" -> "zoe.obrien-smith". Letters, digits, dots and hyphens only. */
export function suggestLocalPart(firstName: string, lastName: string): string {
  const clean = (s: string) =>
    s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '');
  return [clean(firstName), clean(lastName)].filter(Boolean).join('.').slice(0, 40);
}

/** Null when acceptable, otherwise why not. */
export function localPartProblem(local: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,38}[a-z0-9])?$/.test(local)) return 'Use 1-40 lowercase letters, digits, dots or hyphens, starting and ending with a letter or digit.';
  if (local.includes('..')) return 'Two dots in a row aren\'t allowed.';
  if (RESERVED_LOCAL_PARTS.has(local)) return `${local}@ is reserved for the store.`;
  return null;
}

async function migadu(method: 'POST' | 'DELETE', path: string, body?: unknown) {
  const auth = Buffer.from(`${process.env.MIGADU_API_USER}:${process.env.MIGADU_API_KEY}`).toString('base64');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates local@domain and has Migadu email an invitation to `inviteEmail`, where the person sets
 * their own password. Throws a readable error if Migadu refuses (e.g. the name is taken).
 */
export async function createWorkMailbox(local: string, displayName: string, inviteEmail: string): Promise<string> {
  if (!mailboxesEnabled()) throw new Error('Work mailboxes are not set up on this site');
  const problem = localPartProblem(local);
  if (problem) throw new Error(problem);
  const r = await migadu('POST', `/domains/${encodeURIComponent(mailDomain())}/mailboxes`, {
    local_part: local,
    name: displayName,
    password_method: 'invitation',
    password_recovery_email: inviteEmail,
  });
  if (!r.ok) {
    console.error('[mailbox] Migadu refused to create a mailbox', { status: r.status });
    throw new Error(/exist|taken|already/i.test(r.text)
      ? `${local}@${mailDomain()} already exists. Pick another name.`
      : 'The mail provider refused to create that mailbox. Nothing was saved; try again in a minute.');
  }
  return `${local}@${mailDomain()}`;
}

/** Removes local@domain. A mailbox that is already gone counts as removed. */
export async function deleteWorkMailbox(local: string): Promise<boolean> {
  if (!mailboxesEnabled()) return false;
  try {
    const r = await migadu('DELETE', `/domains/${encodeURIComponent(mailDomain())}/mailboxes/${encodeURIComponent(local)}`);
    if (!r.ok && r.status !== 404) console.error('[mailbox] Migadu refused to delete a mailbox', { status: r.status });
    return r.ok || r.status === 404;
  } catch (err) {
    console.error('[mailbox] Migadu unreachable', (err as Error).name);
    return false;
  }
}
