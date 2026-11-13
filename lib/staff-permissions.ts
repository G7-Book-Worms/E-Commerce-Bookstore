// Who can do what in the staff portal (SCRUM-206). Checked on the server for every staff API
// call and page; the portal menu uses the same table to hide links a role can't open.
export type StaffRole = 'admin' | 'manager' | 'employee';

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
  | 'customers.manage'
  | 'activity.view'
  | 'staff.manage';

const EMPLOYEE: Permission[] = [
  'dashboard.view', 'orders.view', 'orders.update', 'inventory.view', 'inventory.stock',
  'messages.view', 'messages.reply',
];
// inventory.manage = prices, sale prices, alert levels, add/edit books
const MANAGER: Permission[] = [...EMPLOYEE, 'inventory.manage', 'discounts.manage', 'customers.view', 'customers.manage', 'activity.view'];
const ADMIN: Permission[] = [...MANAGER, 'staff.manage'];

export const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  employee: new Set(EMPLOYEE),
  manager: new Set(MANAGER),
  admin: new Set(ADMIN),
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  employee: 'Employee',
  manager: 'Manager',
  admin: 'Administrator',
};

export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[role as StaffRole].has(permission);
}
