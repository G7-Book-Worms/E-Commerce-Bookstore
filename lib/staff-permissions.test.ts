import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, canManage, assignableRoles, type StaffRole } from './staff-permissions';

const ALL: StaffRole[] = ['owner', 'admin', 'manager', 'employee'];

test('nobody can manage the owner', () => {
  for (const r of ALL) assert.equal(canManage(r, 'owner'), false, `${r} must not manage owner`);
});

test('peers cannot manage each other', () => {
  assert.equal(canManage('admin', 'admin'), false);
  assert.equal(canManage('manager', 'manager'), false);
  assert.equal(canManage('employee', 'employee'), false);
});

test('management runs strictly downward', () => {
  assert.equal(canManage('owner', 'admin'), true);
  assert.equal(canManage('owner', 'manager'), true);
  assert.equal(canManage('owner', 'employee'), true);
  assert.equal(canManage('admin', 'manager'), true);
  assert.equal(canManage('admin', 'employee'), true);
  assert.equal(canManage('manager', 'employee'), true);
});

test('juniors cannot manage seniors', () => {
  assert.equal(canManage('manager', 'admin'), false);
  assert.equal(canManage('employee', 'manager'), false);
  assert.equal(canManage('employee', 'admin'), false);
});

test('employees manage nobody at all', () => {
  for (const r of ALL) assert.equal(canManage('employee', r), false);
});

test('unknown and empty roles are refused everywhere', () => {
  for (const bad of ['', 'root', 'superuser', undefined, null]) {
    assert.equal(canManage(bad as string, 'employee'), false);
    assert.equal(canManage('owner', bad as string), false);
    assert.equal(can(bad as string, 'staff.manage'), false);
  }
});

test('employees can see and edit customers but not act destructively', () => {
  assert.equal(can('employee', 'customers.view'), true);
  assert.equal(can('employee', 'customers.edit'), true);
  assert.equal(can('employee', 'customers.manage'), false);
  assert.equal(can('manager', 'customers.manage'), true);
});

test('managers and above reach the staff page; employees do not', () => {
  assert.equal(can('employee', 'staff.manage'), false);
  assert.equal(can('manager', 'staff.manage'), true);
  assert.equal(can('admin', 'staff.manage'), true);
  assert.equal(can('owner', 'staff.manage'), true);
});

// Reaching the staff page is not the same as being allowed to act on a row in it.
test('a manager reaching the staff page still cannot touch a peer or a senior', () => {
  assert.equal(can('manager', 'staff.manage'), true);
  assert.equal(canManage('manager', 'manager'), false);
  assert.equal(canManage('manager', 'admin'), false);
  assert.equal(canManage('manager', 'owner'), false);
  assert.equal(canManage('manager', 'employee'), true);
});

test('assignable roles never include your own rank or above', () => {
  assert.deepEqual(assignableRoles('owner'), ['employee', 'manager', 'admin']);
  assert.deepEqual(assignableRoles('admin'), ['employee', 'manager']);
  assert.deepEqual(assignableRoles('manager'), ['employee']);
  assert.deepEqual(assignableRoles('employee'), []);
});
