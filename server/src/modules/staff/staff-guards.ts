// The decision half of staff and customer administration, kept free of the database so it can be
// unit-tested: who may act on whom, which actions are destructive enough to need the acting staff
// member's password again, how many rows one bulk request may carry, and what a scrubbed
// ("deleted") account's fields look like.
//
// Nothing here talks to the client. Every caller re-reads the actor's role from the database
// first; these functions only compare values that the server already trusts.
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { assignableRoles, canManage, isStaffRole, type StaffRole } from '../../../../lib/staff-permissions';

/**
 * Staff roles from least to most senior. Derived from lib/staff-permissions rather than written
 * out again, so the two can never drift: the owner can be assigned every role below itself.
 */
export const ROLE_ORDER: StaffRole[] = [...assignableRoles('owner'), 'owner'];

/** Position in ROLE_ORDER, or -1 for anything that is not a staff role. */
export function roleRank(role: string | undefined | null): number {
  return isStaffRole(role) ? ROLE_ORDER.indexOf(role) : -1;
}

/** True when moving from `from` to `to` lowers the account's seniority. Unknown roles are not a demotion. */
export function isDemotion(from: string | undefined | null, to: string | undefined | null): boolean {
  const before = roleRank(from);
  const after = roleRank(to);
  if (before < 0 || after < 0) return false;
  return after < before;
}

export interface ActorRef {
  id: number;
  role: string;
}
export interface TargetRef {
  id: number;
  role: string;
}

/**
 * The complete "may this staff member change that staff account?" test.
 *
 * canManage() knows the role hierarchy but cannot see which rows are involved, so it cannot tell
 * that an admin is looking at their own row. Both halves are needed, and this is the only thing
 * callers should use:
 *   - the role hierarchy must allow it (strictly downward, never sideways, never the owner), and
 *   - the two accounts must be different (nobody manages themselves).
 */
export function canActOn(actor: ActorRef, target: TargetRef): boolean {
  if (!Number.isInteger(actor.id) || !Number.isInteger(target.id)) return false;
  if (actor.id <= 0 || target.id <= 0) return false;
  if (actor.id === target.id) return false;
  return canManage(actor.role, target.role);
}

export const STAFF_ACTIONS = ['set-role', 'deactivate', 'activate', 'temp-password', 'sign-out', 'delete'] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

export const CUSTOMER_ACTIONS = [
  'update', 'send-reset-link', 'force-reset', 'temp-password', 'sign-out', 'deactivate', 'activate', 'delete',
] as const;
export type CustomerAction = (typeof CUSTOMER_ACTIONS)[number];

/**
 * Staff actions that have to be re-confirmed with the acting staff member's own password:
 * deactivate, delete, force a password reset, and a demotion. Promoting somebody, reactivating
 * them and signing them out are not destructive, so they do not ask again.
 */
export function staffActionNeedsStepUp(
  action: StaffAction,
  roleBefore?: string | null,
  roleAfter?: string | null
): boolean {
  if (action === 'deactivate' || action === 'delete' || action === 'temp-password') return true;
  if (action === 'set-role') return isDemotion(roleBefore, roleAfter);
  return false;
}

/** The same rule for customer accounts. Editing contact details and sending a reset link do not ask. */
export function customerActionNeedsStepUp(action: CustomerAction): boolean {
  return action === 'deactivate' || action === 'delete' || action === 'temp-password' || action === 'force-reset';
}

/** Actions an employee (customers.edit but not customers.manage) is allowed to take on a customer. */
export function customerActionNeedsManage(action: CustomerAction): boolean {
  return action !== 'update' && action !== 'send-reset-link';
}

/**
 * How many accounts one bulk request may touch. Small on purpose: every row is a separate
 * permission check and some actions hash a password, and the whole request has to finish inside
 * the serverless time limit.
 */
export const MAX_BULK = 50;

/** Ids from a bulk request body. Duplicates are collapsed so a row cannot be acted on twice. */
export const bulkIdsSchema = z
  .array(z.number().int().positive('Invalid account id'))
  .min(1, 'Select at least one account')
  .max(MAX_BULK, `Select at most ${MAX_BULK} accounts at a time`)
  .transform((ids) => Array.from(new Set(ids)));

/** A single id from a URL or body. */
export const accountIdSchema = z.number().int().positive('Invalid account id');

export function randomSuffix(bytes = 4): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * The address a scrubbed account gets. Unique (the id plus random hex) so it cannot collide with
 * the unique index on the email column, and obviously not a real person: `.invalid` is reserved by
 * RFC 2606 and can never be registered, so nothing can ever be delivered to it.
 */
export function anonymisedEmail(kind: 'customer' | 'staff', id: number, suffix: string = randomSuffix()): string {
  return `deleted-${kind}-${id}-${suffix}@deleted.invalid`;
}

export const ANONYMISED_DOMAIN = '@deleted.invalid';

/** Whether this account has already been scrubbed, so the UI can label it and not offer it again. */
export function isAnonymised(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(ANONYMISED_DOMAIN);
}

/** Neutral placeholders written over the personally identifying fields of a scrubbed account. */
export const ANONYMISED = {
  firstName: 'Deleted',
  customerLastName: 'Customer',
  staffLastName: 'Staff',
  address: 'Redacted',
} as const;

/** One row's outcome in a bulk request. The reason is for staff, and never names another account. */
export interface BulkOutcome {
  id: number;
  ok: boolean;
  reason?: string;
}

export function bulkSummary(results: BulkOutcome[]): { done: number; skipped: number; message: string } {
  const done = results.filter((r) => r.ok).length;
  const skipped = results.length - done;
  const message = skipped === 0
    ? `${done} ${done === 1 ? 'account' : 'accounts'} updated`
    : `${done} updated, ${skipped} skipped`;
  return { done, skipped, message };
}
