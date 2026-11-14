// Who can do what in the staff portal (SCRUM-206). Checked on the server for every staff API
// call and page; the portal menu uses the same table to hide links a role can't open.
export type StaffRole = 'owner' | 'admin' | 'manager' | 'employee';

export type Permission =
  | 'dashboard.view'
  | 'orders.view'
  | 'orders.update'
  | 'inventory.view'
  | 'inventory.stock'
  | 'inventory.manage'
  | 'messages.view'
  | 'messages.reply'
  | 'discounts.manage'
  | 'customers.view'
  | 'customers.edit'
  | 'customers.manage'
  | 'activity.view'
  | 'staff.manage';

// An employee answers support tickets, so they need to see a customer's details and orders and
// to fix a wrong address or send a reset link. Anything destructive (deactivate, delete, force a
// password change) stays with managers and above - hence customers.edit vs customers.manage.
const EMPLOYEE: Permission[] = [
  'dashboard.view', 'orders.view', 'orders.update', 'inventory.view', 'inventory.stock',
  'messages.view', 'messages.reply', 'customers.view', 'customers.edit',
];
// inventory.manage = prices, sale prices, alert levels, add/edit books.
// staff.manage opens the staff page; which accounts a role may act on there is decided
// separately by canManage(), so a manager sees the page but can only touch employees.
const MANAGER: Permission[] = [
  ...EMPLOYEE, 'inventory.manage', 'discounts.manage', 'customers.manage', 'activity.view', 'staff.manage',
];
const ADMIN: Permission[] = [...MANAGER];
const OWNER: Permission[] = [...ADMIN];

export const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  employee: new Set(EMPLOYEE),
  manager: new Set(MANAGER),
  admin: new Set(ADMIN),
  owner: new Set(OWNER),
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  employee: 'Employee',
  manager: 'Manager',
  admin: 'Administrator',
  owner: 'Owner',
};

// Seniority only decides who may manage whom; it does not grant permissions, which come from the
// table above. Peers are deliberately equal-ranked so that the > comparison in canManage() is
// false between them: a manager cannot act on another manager, nor an admin on another admin.
const RANK: Record<StaffRole, number> = { employee: 0, manager: 1, admin: 2, owner: 3 };

export function isStaffRole(role: string | undefined | null): role is StaffRole {
  return !!role && role in ROLE_PERMISSIONS;
}

export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!isStaffRole(role)) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

/**
 * Whether `actor` may change the account of `target` - change its role, deactivate it, force a
 * password reset, or delete it.
 *
 * Management runs strictly downward, never sideways:
 *   owner    -> admin, manager, employee   (and nobody may manage the owner)
 *   admin    -> manager, employee          (not other admins)
 *   manager  -> employee                   (not other managers)
 *   employee -> nobody
 *
 * Callers must also pass distinct accounts: nobody manages themselves, which is enforced by the
 * actorId/targetId check at the call site because this function only sees roles.
 */
export function canManage(actor: string | undefined | null, target: string | undefined | null): boolean {
  if (!isStaffRole(actor) || !isStaffRole(target)) return false;
  if (!ROLE_PERMISSIONS[actor].has('staff.manage')) return false;
  if (target === 'owner') return false;
  return RANK[actor] > RANK[target];
}

/** The roles `actor` is allowed to assign when creating or promoting staff. */
export function assignableRoles(actor: string | undefined | null): StaffRole[] {
  if (!isStaffRole(actor)) return [];
  return (Object.keys(RANK) as StaffRole[])
    .filter((r) => canManage(actor, r))
    .sort((a, b) => RANK[a] - RANK[b]);
}
