import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountUpdatedByStaffEmail, emailChangedConfirmationEmail, orderStatusEmail, securityAlertEmail } from './templates';
import { canUnlockSignIn } from '../staff/staff-guards';
import { signInLockKeys } from '../../shared/security/lock-keys';

test('security alert subjects are title case and say what happened', () => {
  const e = securityAlertEmail('a@example.test', 'Ada', { subject: 'Account Locked', title: 'Account Locked After Multiple Failed Sign-In Attempts', body: 'x', facts: [['When', 'now']] }, 'customer');
  assert.equal(e.subject, 'Security Alert: Account Locked');
  assert.match(e.html, /Security Alert<\/span>/);
  assert.match(e.text, /^SECURITY ALERT: Account Locked After Multiple Failed Sign-In Attempts/);
  assert.match(e.text, /If this was you, no action is needed/);
  assert.match(e.text, /If this wasn't you, reset your password/);
});

test('a change made by staff tells the customer how to object, not to reset the password', () => {
  const e = securityAlertEmail('a@example.test', 'Ada', { subject: 'T', title: 'T', body: 'x', facts: [], byStaff: true }, 'customer');
  assert.match(e.text, /If you did not request this change, reply to this email or contact support/);
  assert.match(e.html, /Contact Support/);
});

test('staff profile edits list the changes and escape what was typed', () => {
  const e = accountUpdatedByStaffEmail('a@example.test', '<Ada>', ['First name changed to <b>Bob</b>']);
  assert.equal(e.subject, 'Account Details Updated');
  assert.ok(!e.html.includes('<b>Bob</b>'));
  assert.ok(e.html.includes('&lt;b&gt;Bob&lt;/b&gt;'));
  assert.match(e.text, /reply to this email or contact support/i);
});

test('the new address is told it is now the sign-in email', () => {
  const e = emailChangedConfirmationEmail('new@example.test', 'Ada', true);
  assert.equal(e.to, 'new@example.test');
  assert.match(e.text, /by the Book Worms support team/);
});

test('order status subjects read as sentences in title case', () => {
  assert.equal(orderStatusEmail('a@x.test', 'Ada', 7, 'transit').subject, 'Your Order #7 Has Shipped');
  assert.equal(orderStatusEmail('a@x.test', 'Ada', 7, 'cancelled').subject, 'Your Order #7 Has Been Cancelled');
});

test('only administrators and the owner may end a lockout early', () => {
  assert.equal(canUnlockSignIn('admin'), true);
  assert.equal(canUnlockSignIn('owner'), true);
  assert.equal(canUnlockSignIn('manager'), false);
  assert.equal(canUnlockSignIn('employee'), false);
});

test('lock keys match the ones sign-in uses', () => {
  assert.deepEqual(signInLockKeys('customer', 5, 'Ada@Example.test '), ['login:email:ada@example.test', 'mfa:customer:5', 'relock:customer:5']);
  assert.deepEqual(signInLockKeys('staff', 2, 'ed@example.com'), ['staff-login:email:ed@example.com', 'mfa:admin:2', 'relock:staff:2']);
});
