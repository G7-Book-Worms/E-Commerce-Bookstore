// Turns the raw action names in the activity log (e.g. "order.placed_as_guest") into a category and a
// plain-English label for staff who don't read code. Pure, so it is shared by the page, the query and
// the tests.
//
// Adding a new logActivity() action? Give it an entry in ACTION_INFO below. If you forget, it still
// lands in a sensible category through its prefix (see CATEGORY_PREFIXES) and gets a label made from
// the action name, so nothing breaks, it just reads less nicely.

export const ACTIVITY_CATEGORIES = [
  'security',
  'orders',
  'inventory',
  'customers',
  'staff',
  'discounts',
  'messages',
  'other',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type CategoryColor = 'red' | 'green' | 'amber' | 'blue' | 'indigo' | 'pink' | 'teal' | 'gray';

export const CATEGORY_INFO: Record<ActivityCategory, { label: string; color: CategoryColor; description: string }> = {
  security: { label: 'Security', color: 'red', description: 'Sign-ins, failed sign-ins, lockouts, sign-outs, password and two-step verification changes' },
  orders: { label: 'Orders & payments', color: 'green', description: 'Checkouts, placed orders, status changes and refunds' },
  inventory: { label: 'Inventory', color: 'amber', description: 'Books, stock counts, prices and low-stock alerts' },
  customers: { label: 'Customers', color: 'blue', description: 'New accounts and changes staff made to customer accounts' },
  staff: { label: 'Staff accounts', color: 'indigo', description: 'Staff accounts created, changed, deactivated or removed' },
  discounts: { label: 'Discounts', color: 'pink', description: 'Discount codes created, edited, turned on or off' },
  messages: { label: 'Messages & tickets', color: 'teal', description: 'Contact form messages, support tickets, mailbox syncs and alerts' },
  other: { label: 'System / Other', color: 'gray', description: 'Anything that does not fit another category' },
};

type ActionInfo = { category: ActivityCategory; label: string; failure?: boolean };

/** Every action the code logs today (plus a few being added), with its category and label. */
export const ACTION_INFO: Readonly<Record<string, ActionInfo>> = {
  // --- Security: customer sign-in and passwords -------------------------------------------------
  'auth.login': { category: 'security', label: 'Customer signed in' },
  'auth.login_failed': { category: 'security', label: 'Failed customer sign-in (wrong email or password)', failure: true },
  'auth.locked_out': { category: 'security', label: 'Customer account locked after too many failed sign-ins', failure: true },
  'auth.locked': { category: 'security', label: 'Customer account locked after too many failed sign-ins', failure: true },
  'auth.logout': { category: 'security', label: 'Customer signed out' },
  'auth.password_changed': { category: 'security', label: 'Customer changed their password' },
  'auth.password_reset_requested': { category: 'security', label: 'Customer asked for a password reset email' },
  'auth.password_reset': { category: 'security', label: 'Customer reset their password from the email link' },

  // --- Security: staff sign-in and passwords ----------------------------------------------------
  'staff.login': { category: 'security', label: 'Staff member signed in' },
  'staff.login_failed': { category: 'security', label: 'Failed staff sign-in (wrong email or password)', failure: true },
  'staff.locked_out': { category: 'security', label: 'Staff account locked after too many failed sign-ins', failure: true },
  'staff.logout': { category: 'security', label: 'Staff member signed out' },
  'staff.password_changed': { category: 'security', label: 'Staff member changed their password' },
  'staff.step_up_failed': { category: 'security', label: 'Wrong password on a protected staff action', failure: true },

  // --- Security: two-step verification and alerts ------------------------------------------------
  'security.mfa_enabled': { category: 'security', label: 'Two-step verification turned on' },
  'security.mfa_disabled': { category: 'security', label: 'Two-step verification turned off' },
  'security.mfa_method_changed': { category: 'security', label: 'Two-step verification method changed' },
  'security.mfa_code_sent': { category: 'security', label: 'Verification code sent' },
  'security.mfa_verified': { category: 'security', label: 'Verification code accepted' },
  'security.mfa_failed': { category: 'security', label: 'Wrong or expired verification code', failure: true },
  'security.new_sign_in_alert': { category: 'security', label: 'New sign-in alert emailed to the account owner' },
  'security.lockout_alert': { category: 'security', label: 'Account lockout alert emailed to the account owner' },

  // --- Orders & payments ------------------------------------------------------------------------
  'checkout.started': { category: 'orders', label: 'Customer started checkout' },
  'checkout.guest_started': { category: 'orders', label: 'Guest started checkout' },
  'order.placed': { category: 'orders', label: 'Customer placed an order' },
  'order.placed_as_guest': { category: 'orders', label: 'Guest placed an order' },
  'order.cancelled_out_of_stock': { category: 'orders', label: 'Order cancelled: a book sold out during payment' },
  'order.status_changed': { category: 'orders', label: 'Order status changed' },
  'order.bulk_status_changed': { category: 'orders', label: 'Status changed on several orders at once' },
  'payment.auto_refunded': { category: 'orders', label: 'Payment refunded automatically' },

  // --- Inventory --------------------------------------------------------------------------------
  'inventory.low_stock': { category: 'inventory', label: 'Low-stock alert' },
  'inventory.restock': { category: 'inventory', label: 'Copies added to stock (restock)' },
  'inventory.adjustment': { category: 'inventory', label: 'Stock count corrected' },
  'inventory.pricing_changed': { category: 'inventory', label: 'Price or low-stock level changed' },
  'book.created': { category: 'inventory', label: 'New book added to the catalogue' },
  'book.updated': { category: 'inventory', label: 'Book details edited' },

  // --- Customers --------------------------------------------------------------------------------
  'auth.register': { category: 'customers', label: 'New customer account created' },
  'customer.updated': { category: 'customers', label: "Staff edited a customer's details" },
  'customer.reset_link_sent': { category: 'customers', label: 'Staff sent a customer a password reset link' },
  'customer.password_reset_forced': { category: 'customers', label: 'Staff made a customer choose a new password' },
  'customer.temp_password_set': { category: 'customers', label: 'Staff gave a customer a temporary password' },
  'customer.signed_out_everywhere': { category: 'customers', label: 'Staff signed a customer out on all devices' },
  'customer.activated': { category: 'customers', label: 'Customer account reactivated' },
  'customer.deactivated': { category: 'customers', label: 'Customer account deactivated' },
  'customer.anonymised': { category: 'customers', label: 'Customer account deleted (personal details removed)' },
  'customer.bulk_activate': { category: 'customers', label: 'Customer reactivated (bulk action)' },
  'customer.bulk_deactivate': { category: 'customers', label: 'Customer deactivated (bulk action)' },
  'customer.bulk_force_reset': { category: 'customers', label: 'Customer made to choose a new password (bulk action)' },
  'customer.bulk_delete': { category: 'customers', label: 'Customer account deleted (bulk action)' },
  'customer.bulk_activate_summary': { category: 'customers', label: 'Bulk reactivate customers: summary' },
  'customer.bulk_deactivate_summary': { category: 'customers', label: 'Bulk deactivate customers: summary' },
  'customer.bulk_force_reset_summary': { category: 'customers', label: 'Bulk password reset for customers: summary' },
  'customer.bulk_delete_summary': { category: 'customers', label: 'Bulk delete customers: summary' },

  // --- Staff accounts (written as `staff.${action}` by /api/staff/accounts/[id]) -----------------
  'staff.created': { category: 'staff', label: 'Staff account created' },
  'customer.order_texts_on': { category: 'customers', label: 'Customer turned on order-update texts' },
  'customer.order_texts_off': { category: 'customers', label: 'Customer turned off order-update texts' },
  'staff.mailbox_created': { category: 'staff', label: 'Work mailbox created' },
  'staff.mailbox_deleted': { category: 'staff', label: 'Work mailbox removed' },
  'staff.mailbox_delete_failed': { category: 'staff', label: 'Work mailbox could not be removed', failure: true },
  'staff.set_role': { category: 'staff', label: "Staff member's role changed" },
  'staff.activate': { category: 'staff', label: 'Staff account reactivated' },
  'staff.deactivate': { category: 'staff', label: 'Staff account deactivated' },
  'staff.temp_password': { category: 'staff', label: 'Staff member given a temporary password' },
  'staff.sign_out': { category: 'staff', label: 'Staff member signed out on all devices' },
  'staff.anonymised': { category: 'staff', label: 'Staff account deleted (personal details removed)' },

  // --- Discounts --------------------------------------------------------------------------------
  'discount.created': { category: 'discounts', label: 'Discount code created' },
  'discount.updated': { category: 'discounts', label: 'Discount code edited' },
  'discount.activated': { category: 'discounts', label: 'Discount code turned on' },
  'discount.deactivated': { category: 'discounts', label: 'Discount code turned off' },

  // --- Messages & tickets -----------------------------------------------------------------------
  'message.received': { category: 'messages', label: 'Contact form message received' },
  'message.replied': { category: 'messages', label: 'Staff replied to a message' },
  'message.status_changed': { category: 'messages', label: 'Message status changed' },
  'ticket.replied': { category: 'messages', label: 'Staff replied to a support ticket' },
  'ticket.assigned': { category: 'messages', label: 'Support ticket assigned' },
  'ticket.status_changed': { category: 'messages', label: 'Support ticket status changed' },
  'mailbox.converted_to_ticket': { category: 'messages', label: 'Email turned into a support ticket' },
  'mail.sync_requested': { category: 'messages', label: 'Staff checked the support mailbox for new email' },
  'mail.synced': { category: 'messages', label: 'New email collected from the support mailbox' },
  'alert.marked_read': { category: 'messages', label: 'Staff alert marked as read' },
  'alerts.marked_all_read': { category: 'messages', label: 'All staff alerts marked as read' },
};

/**
 * Fallback for actions not in ACTION_INFO, by the part before the first dot. Order matters only for
 * readability; prefixes never overlap.
 */
export const CATEGORY_PREFIXES: Readonly<Record<Exclude<ActivityCategory, 'other'>, readonly string[]>> = {
  security: ['security.', 'auth.', 'mfa.', 'session.', 'login.'],
  orders: ['order.', 'orders.', 'payment.', 'payments.', 'checkout.', 'refund.'],
  inventory: ['inventory.', 'book.', 'books.', 'stock.'],
  customers: ['customer.', 'customers.', 'user.', 'users.'],
  staff: ['staff.', 'admin.'],
  discounts: ['discount.', 'discounts.', 'coupon.'],
  messages: ['message.', 'messages.', 'ticket.', 'tickets.', 'mail.', 'mailbox.', 'alert.', 'alerts.', 'contact.'],
};

const PREFIX_CATEGORIES = Object.entries(CATEGORY_PREFIXES) as [Exclude<ActivityCategory, 'other'>, readonly string[]][];
const FAILURE_WORDS = /(^|[._])(failed|failure|locked|locked_out|lockout|denied|blocked)($|[._])/;

export function isActivityCategory(value: unknown): value is ActivityCategory {
  return typeof value === 'string' && (ACTIVITY_CATEGORIES as readonly string[]).includes(value);
}

function prefixCategory(action: string): ActivityCategory {
  for (const [category, prefixes] of PREFIX_CATEGORIES) {
    if (prefixes.some((p) => action.startsWith(p))) return category;
  }
  return 'other';
}

/** "security.mfa_backup_used" -> "Security: mfa backup used". */
export function labelFromAction(action: string): string {
  const words = (s: string) => s.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().toLowerCase();
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const dot = action.indexOf('.');
  if (dot <= 0) return cap(words(action)) || 'Unknown action';
  const head = cap(words(action.slice(0, dot)));
  const rest = words(action.slice(dot + 1).replace(/\./g, ' '));
  return rest ? `${head}: ${rest}` : head;
}

export type ActivityDescription = {
  category: ActivityCategory;
  categoryLabel: string;
  color: CategoryColor;
  label: string;
  /** A failed or blocked security event (failed sign-in, lockout, wrong step-up password...). */
  failure: boolean;
  /** False when the label was generated from the action name. */
  known: boolean;
};

export function describeAction(action: string): ActivityDescription {
  const info = Object.prototype.hasOwnProperty.call(ACTION_INFO, action) ? ACTION_INFO[action] : undefined;
  const category = info?.category ?? prefixCategory(action);
  const failure = info ? !!info.failure : category === 'security' && FAILURE_WORDS.test(action);
  return {
    category,
    categoryLabel: CATEGORY_INFO[category].label,
    color: CATEGORY_INFO[category].color,
    label: info?.label ?? labelFromAction(action),
    failure,
    known: !!info,
  };
}

export const categorizeAction = (action: string): ActivityCategory => describeAction(action).category;

/**
 * What the SQL filter for a category has to match, written so it agrees with describeAction():
 * an action is in the category when it is one of `exact`, or when it is NOT a known action and it
 * starts with one of `prefixes` (for "other": starts with none of `excludePrefixes`).
 */
export type CategoryFilterSpec = {
  exact: string[];
  knownActions: string[];
  prefixes: string[];
  excludePrefixes: string[];
};

export function categoryFilterSpec(category: ActivityCategory): CategoryFilterSpec {
  const knownActions = Object.keys(ACTION_INFO);
  const exact = knownActions.filter((a) => ACTION_INFO[a].category === category);
  if (category === 'other') {
    return { exact, knownActions, prefixes: [], excludePrefixes: PREFIX_CATEGORIES.flatMap(([, p]) => p) };
  }
  return { exact, knownActions, prefixes: [...CATEGORY_PREFIXES[category]], excludePrefixes: [] };
}

/** Plain-JS version of the SQL the spec turns into; used by the tests to prove the two agree. */
export function matchesFilterSpec(spec: CategoryFilterSpec, action: string): boolean {
  if (spec.exact.includes(action)) return true;
  if (spec.knownActions.includes(action)) return false;
  if (spec.prefixes.length) return spec.prefixes.some((p) => action.startsWith(p));
  return !spec.excludePrefixes.some((p) => action.startsWith(p));
}

/** Escapes LIKE wildcards so a prefix such as "staff." matches literally. */
export function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
