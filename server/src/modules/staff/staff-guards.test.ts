// Unit tests for the decision half of staff/customer administration: npx tsx --test
// server/src/modules/staff/staff-guards.test.ts
//
// Nothing here touches the database. The rules pinned by lib/staff-permissions.test.ts are not
// repeated; what is tested here is the part canManage() cannot see (which account is which) and
// the choices layered on top of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANONYMISED,
  MAX_BULK,
  ROLE_ORDER,
  anonymisedEmail,
  bulkIdsSchema,
  bulkSummary,
  canActOn,
  customerActionNeedsManage,
  customerActionNeedsStepUp,
  isDemotion,
  roleRank,
  staffActionNeedsStepUp,
} from './staff-guards';
import type { StaffRole } from '../../../../lib/staff-permissions';

const ALL: StaffRole[] = ['owner', 'admin', 'manager', 'employee'];

test('role order runs employee -> owner and matches the permission table', () => {
  assert.deepEqual(ROLE_ORDER, ['employee', 'manager', 'admin', 'owner']);
  assert.equal(roleRank('employee'), 0);
  assert.equal(roleRank('owner'), 3);
  assert.equal(roleRank('root'), -1);
  assert.equal(roleRank(undefined), -1);
});

test('nobody can act on their own account, whatever their role', () => {
  for (const role of ALL) {
    assert.equal(canActOn({ id: 7, role }, { id: 7, role }), false, `${role} must not act on itself`);
  }
  // Not even when the roles would allow it if they were two different people
  assert.equal(canActOn({ id: 7, role: 'owner' }, { id: 7, role: 'employee' }), false);
  assert.equal(canActOn({ id: 7, role: 'admin' }, { id: 7, role: 'manager' }), false);
});

test('canActOn keeps the downward-only hierarchy', () => {
  assert.equal(canActOn({ id: 1, role: 'owner' }, { id: 2, role: 'admin' }), true);
  assert.equal(canActOn({ id: 1, role: 'admin' }, { id: 2, role: 'manager' }), true);
  assert.equal(canActOn({ id: 1, role: 'manager' }, { id: 2, role: 'employee' }), true);
  // sideways
  assert.equal(canActOn({ id: 1, role: 'admin' }, { id: 2, role: 'admin' }), false);
  assert.equal(canActOn({ id: 1, role: 'manager' }, { id: 2, role: 'manager' }), false);
  // upward
  assert.equal(canActOn({ id: 1, role: 'manager' }, { id: 2, role: 'admin' }), false);
  assert.equal(canActOn({ id: 1, role: 'employee' }, { id: 2, role: 'employee' }), false);
  // the owner is untouchable
  for (const role of ALL) assert.equal(canActOn({ id: 1, role }, { id: 2, role: 'owner' }), false);
});

test('canActOn refuses unknown roles and ids that are not real row ids', () => {
  assert.equal(canActOn({ id: 1, role: 'superuser' }, { id: 2, role: 'employee' }), false);
  assert.equal(canActOn({ id: 1, role: '' }, { id: 2, role: 'employee' }), false);
  assert.equal(canActOn({ id: 1, role: 'owner' }, { id: 2, role: 'superuser' }), false);
  assert.equal(canActOn({ id: 0, role: 'owner' }, { id: 2, role: 'employee' }), false);
  assert.equal(canActOn({ id: 1, role: 'owner' }, { id: -3, role: 'employee' }), false);
  assert.equal(canActOn({ id: 1.5, role: 'owner' }, { id: 2, role: 'employee' }), false);
  assert.equal(canActOn({ id: NaN, role: 'owner' }, { id: 2, role: 'employee' }), false);
});

test('a demotion is any move down the order; a promotion is not', () => {
  assert.equal(isDemotion('admin', 'manager'), true);
  assert.equal(isDemotion('admin', 'employee'), true);
  assert.equal(isDemotion('manager', 'employee'), true);
  assert.equal(isDemotion('owner', 'admin'), true);
  assert.equal(isDemotion('employee', 'manager'), false);
  assert.equal(isDemotion('manager', 'admin'), false);
  assert.equal(isDemotion('admin', 'admin'), false);
  assert.equal(isDemotion('admin', 'nonsense'), false);
  assert.equal(isDemotion(null, 'employee'), false);
});

test('destructive staff actions ask for the password again', () => {
  assert.equal(staffActionNeedsStepUp('deactivate'), true);
  assert.equal(staffActionNeedsStepUp('delete'), true);
  assert.equal(staffActionNeedsStepUp('temp-password'), true);
  assert.equal(staffActionNeedsStepUp('set-role', 'admin', 'employee'), true);
});

test('reversible staff actions do not', () => {
  assert.equal(staffActionNeedsStepUp('activate'), false);
  assert.equal(staffActionNeedsStepUp('sign-out'), false);
  assert.equal(staffActionNeedsStepUp('set-role', 'employee', 'manager'), false);
  assert.equal(staffActionNeedsStepUp('set-role', 'manager', 'manager'), false);
});

test('customer actions: destructive ones ask, editing and reset links do not', () => {
  assert.equal(customerActionNeedsStepUp('deactivate'), true);
  assert.equal(customerActionNeedsStepUp('delete'), true);
  assert.equal(customerActionNeedsStepUp('temp-password'), true);
  assert.equal(customerActionNeedsStepUp('force-reset'), true);
  assert.equal(customerActionNeedsStepUp('activate'), false);
  assert.equal(customerActionNeedsStepUp('sign-out'), false);
  assert.equal(customerActionNeedsStepUp('update'), false);
  assert.equal(customerActionNeedsStepUp('send-reset-link'), false);
});

test('only editing details and sending a reset link are open to customers.edit', () => {
  assert.equal(customerActionNeedsManage('update'), false);
  assert.equal(customerActionNeedsManage('send-reset-link'), false);
  for (const a of ['temp-password', 'force-reset', 'sign-out', 'deactivate', 'activate', 'delete'] as const) {
    assert.equal(customerActionNeedsManage(a), true, `${a} must need customers.manage`);
  }
});

test('bulk ids: positive integers only, deduplicated, and capped', () => {
  assert.deepEqual(bulkIdsSchema.parse([3, 1, 3, 2]), [3, 1, 2]);
  assert.equal(bulkIdsSchema.safeParse([]).success, false);
  assert.equal(bulkIdsSchema.safeParse([0]).success, false);
  assert.equal(bulkIdsSchema.safeParse([-1]).success, false);
  assert.equal(bulkIdsSchema.safeParse([1.5]).success, false);
  assert.equal(bulkIdsSchema.safeParse(['1']).success, false);
  assert.equal(bulkIdsSchema.safeParse([1, null]).success, false);
  assert.equal(bulkIdsSchema.safeParse('all').success, false);
  const tooMany = Array.from({ length: MAX_BULK + 1 }, (_, i) => i + 1);
  assert.equal(bulkIdsSchema.safeParse(tooMany).success, false);
  assert.equal(bulkIdsSchema.safeParse(tooMany.slice(0, MAX_BULK)).success, true);
});

test('a scrubbed account gets a unique address at a domain that can never exist', () => {
  const email = anonymisedEmail('customer', 42, 'abcd1234');
  assert.equal(email, 'deleted-customer-42-abcd1234@deleted.invalid');
  assert.ok(email.endsWith('.invalid'), 'must be an unroutable reserved domain');
  assert.ok(email.length <= 100, 'must fit the email column');
  // Two scrubs of the same row still differ, so the unique index cannot collide
  assert.notEqual(anonymisedEmail('customer', 42), anonymisedEmail('customer', 42));
  assert.notEqual(anonymisedEmail('staff', 42, 'abcd1234'), anonymisedEmail('customer', 42, 'abcd1234'));
  // A long id still fits
  assert.ok(anonymisedEmail('customer', 2147483647).length <= 100);
});

test('placeholders carry no personal information', () => {
  for (const value of Object.values(ANONYMISED)) {
    assert.ok(value.length > 0);
    assert.ok(!value.includes('@'));
  }
});

test('bulk summary counts what was skipped', () => {
  assert.equal(bulkSummary([{ id: 1, ok: true }]).message, '1 account updated');
  assert.equal(bulkSummary([{ id: 1, ok: true }, { id: 2, ok: true }]).message, '2 accounts updated');
  const mixed = bulkSummary([{ id: 1, ok: true }, { id: 2, ok: false, reason: 'Not allowed' }]);
  assert.equal(mixed.done, 1);
  assert.equal(mixed.skipped, 1);
  assert.equal(mixed.message, '1 updated, 1 skipped');
});
