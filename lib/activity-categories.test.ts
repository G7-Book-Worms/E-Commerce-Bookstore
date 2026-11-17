import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_INFO,
  ACTIVITY_CATEGORIES,
  CATEGORY_INFO,
  categorizeAction,
  categoryFilterSpec,
  describeAction,
  isActivityCategory,
  labelFromAction,
  likePrefix,
  matchesFilterSpec,
  type ActivityCategory,
} from './activity-categories';

// Every action string the code passes to logActivity() or the staffApi `log` helper today,
// including the ones built from templates (inventory.${kind}, staff.${action}, customer.bulk_*).
const LOGGED_TODAY: Record<string, ActivityCategory> = {
  'auth.login': 'security', 'auth.login_failed': 'security', 'auth.locked_out': 'security',
  'auth.password_changed': 'security', 'auth.password_reset_requested': 'security', 'auth.password_reset': 'security',
  'staff.login': 'security', 'staff.login_failed': 'security', 'staff.locked_out': 'security',
  'staff.password_changed': 'security', 'staff.step_up_failed': 'security',
  'checkout.started': 'orders', 'checkout.guest_started': 'orders', 'order.placed': 'orders',
  'order.placed_as_guest': 'orders', 'order.cancelled_out_of_stock': 'orders', 'order.status_changed': 'orders',
  'order.bulk_status_changed': 'orders', 'payment.auto_refunded': 'orders',
  'inventory.low_stock': 'inventory', 'inventory.restock': 'inventory', 'inventory.adjustment': 'inventory',
  'inventory.pricing_changed': 'inventory', 'book.created': 'inventory', 'book.updated': 'inventory',
  'auth.register': 'customers', 'customer.updated': 'customers', 'customer.reset_link_sent': 'customers',
  'customer.password_reset_forced': 'customers', 'customer.temp_password_set': 'customers',
  'customer.signed_out_everywhere': 'customers', 'customer.anonymised': 'customers',
  'customer.activated': 'customers', 'customer.deactivated': 'customers',
  'customer.bulk_activate': 'customers', 'customer.bulk_deactivate': 'customers',
  'customer.bulk_force_reset': 'customers', 'customer.bulk_delete': 'customers',
  'customer.bulk_activate_summary': 'customers', 'customer.bulk_deactivate_summary': 'customers',
  'customer.bulk_force_reset_summary': 'customers', 'customer.bulk_delete_summary': 'customers',
  'staff.created': 'staff', 'staff.set_role': 'staff', 'staff.activate': 'staff', 'staff.deactivate': 'staff',
  'staff.temp_password': 'staff', 'staff.sign_out': 'staff', 'staff.anonymised': 'staff',
  'discount.created': 'discounts', 'discount.updated': 'discounts', 'discount.activated': 'discounts', 'discount.deactivated': 'discounts',
  'message.received': 'messages', 'message.replied': 'messages', 'message.status_changed': 'messages',
  'ticket.replied': 'messages', 'ticket.assigned': 'messages', 'ticket.status_changed': 'messages',
  'mailbox.converted_to_ticket': 'messages', 'mail.sync_requested': 'messages', 'mail.synced': 'messages',
  'alert.marked_read': 'messages', 'alerts.marked_all_read': 'messages',
};

// Being added in a parallel change (two-step verification and alerts); they must already read well.
const UPCOMING = [
  'security.mfa_enabled', 'security.mfa_disabled', 'security.mfa_method_changed', 'security.mfa_code_sent',
  'security.mfa_verified', 'security.mfa_failed', 'security.new_sign_in_alert', 'security.lockout_alert',
  'auth.login_failed', 'auth.locked', 'auth.logout', 'staff.login_failed', 'staff.logout',
];

test('every action logged today has a hand-written label in the right category', () => {
  for (const [action, category] of Object.entries(LOGGED_TODAY)) {
    const d = describeAction(action);
    assert.equal(d.known, true, `${action} needs an entry in ACTION_INFO`);
    assert.equal(d.category, category, action);
    assert.doesNotMatch(d.label, /[._]/, `${action} label should be plain English: ${d.label}`);
  }
});

test('the upcoming security actions are labelled and filed under Security', () => {
  for (const action of UPCOMING) {
    const d = describeAction(action);
    assert.equal(d.known, true, action);
    assert.equal(d.category, 'security', action);
  }
});

test('examples staff will see read naturally', () => {
  assert.equal(describeAction('order.placed_as_guest').label, 'Guest placed an order');
  assert.equal(describeAction('staff.step_up_failed').label, 'Wrong password on a protected staff action');
  assert.equal(describeAction('security.mfa_enabled').label, 'Two-step verification turned on');
});

test('failed and blocked security events are flagged, ordinary ones are not', () => {
  for (const a of ['auth.login_failed', 'auth.locked_out', 'auth.locked', 'staff.login_failed', 'staff.locked_out', 'staff.step_up_failed', 'security.mfa_failed']) {
    assert.equal(describeAction(a).failure, true, a);
  }
  for (const a of ['auth.login', 'auth.logout', 'staff.login', 'security.mfa_verified', 'security.lockout_alert', 'order.placed', 'customer.deactivated']) {
    assert.equal(describeAction(a).failure, false, a);
  }
});

test('unknown actions fall back to their prefix', () => {
  assert.equal(categorizeAction('security.passkey_added'), 'security');
  assert.equal(categorizeAction('auth.something_new'), 'security');
  assert.equal(categorizeAction('payment.disputed'), 'orders');
  assert.equal(categorizeAction('checkout.abandoned'), 'orders');
  assert.equal(categorizeAction('stock.recount'), 'inventory');
  assert.equal(categorizeAction('book.deleted'), 'inventory');
  assert.equal(categorizeAction('customer.merged'), 'customers');
  assert.equal(categorizeAction('staff.promoted'), 'staff');
  assert.equal(categorizeAction('discount.expired'), 'discounts');
  assert.equal(categorizeAction('ticket.merged'), 'messages');
  assert.equal(categorizeAction('cron.ran'), 'other');
  assert.equal(categorizeAction('nodot'), 'other');
  assert.equal(categorizeAction(''), 'other');
  // A prefix must match up to the dot, not just the start of a word.
  assert.equal(categorizeAction('authors.updated'), 'other');
  assert.equal(categorizeAction('orderly.thing'), 'other');
});

test('unknown failed security actions are still flagged', () => {
  assert.equal(describeAction('security.passkey_failed').failure, true);
  assert.equal(describeAction('auth.account_locked').failure, true);
  assert.equal(describeAction('order.payment_failed').failure, false, 'only security events are highlighted');
});

test('generated labels come from the action name', () => {
  assert.equal(labelFromAction('security.passkey_added'), 'Security: passkey added');
  assert.equal(labelFromAction('order.refund.issued'), 'Order: refund issued');
  assert.equal(labelFromAction('somethingHappened'), 'Something happened');
  assert.equal(labelFromAction(''), 'Unknown action');
  assert.equal(describeAction('cron.ran').label, 'Cron: ran');
});

test('inherited object keys are not mistaken for known actions', () => {
  assert.equal(describeAction('toString').known, false);
  assert.equal(describeAction('constructor').category, 'other');
});

test('every category has display info and every known action uses a real category', () => {
  for (const c of ACTIVITY_CATEGORIES) assert.ok(CATEGORY_INFO[c].label);
  for (const [action, info] of Object.entries(ACTION_INFO)) assert.ok(isActivityCategory(info.category), action);
  assert.equal(isActivityCategory('security'), true);
  assert.equal(isActivityCategory('Security'), false);
  assert.equal(isActivityCategory('__proto__'), false);
});

test('the SQL filter spec for each category matches exactly the actions describeAction puts there', () => {
  const samples = [
    ...Object.keys(ACTION_INFO), ...UPCOMING,
    'security.passkey_added', 'auth.new', 'payment.disputed', 'stock.recount', 'customer.merged',
    'staff.promoted', 'discount.expired', 'ticket.merged', 'cron.ran', 'nodot', 'authors.updated', 'admin.thing', 'user.x',
  ];
  for (const category of ACTIVITY_CATEGORIES) {
    const spec = categoryFilterSpec(category);
    for (const action of samples) {
      assert.equal(matchesFilterSpec(spec, action), categorizeAction(action) === category, `${category} / ${action}`);
    }
  }
});

test('auth.register is a customer event even though auth.* is Security', () => {
  const security = categoryFilterSpec('security');
  assert.equal(matchesFilterSpec(security, 'auth.register'), false);
  assert.equal(matchesFilterSpec(categoryFilterSpec('customers'), 'auth.register'), true);
});

test('LIKE prefixes are escaped so they match literally', () => {
  assert.equal(likePrefix('staff.'), 'staff.%');
  assert.equal(likePrefix('a_b%'), 'a\\_b\\%%');
});
