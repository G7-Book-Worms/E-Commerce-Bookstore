// Staff portal shell: sidebar on laptops, scrolling tab bar on phones. Links a role can't
// use are hidden (the pages and APIs also refuse them on the server).
import Link from 'next/link';
import { Suspense } from 'react';
import { getStaffSession } from '@/server/src/modules/staff/staff-page';
import { can, ROLE_LABELS, type Permission } from '@/lib/staff-permissions';
import { messageCounts } from '@/server/src/modules/contact/contact-service';
import { inventoryCounts } from '@/server/src/modules/inventory/inventory-service';
import { SignOutButton } from '@/components/staff/sign-out-button';
import { NavLink } from '@/components/staff/nav-link';

const NAV: { href: string; label: string; permission: Permission; badge?: 'messages' | 'stock' }[] = [
  { href: '/admin', label: 'Dashboard', permission: 'dashboard.view' },
  { href: '/admin/orders', label: 'Orders', permission: 'orders.view' },
  { href: '/admin/inventory', label: 'Inventory', permission: 'inventory.view', badge: 'stock' },
  { href: '/admin/messages', label: 'Messages', permission: 'messages.view', badge: 'messages' },
  { href: '/admin/discounts', label: 'Discounts', permission: 'discounts.manage' },
  { href: '/admin/customers', label: 'Customers', permission: 'customers.view' },
  { href: '/admin/activity', label: 'Activity log', permission: 'activity.view' },
  { href: '/admin/staff', label: 'Staff', permission: 'staff.manage' },
];

async function Nav() {
  const staff = await getStaffSession();
  if (!staff) return null;
  const [msgs, stock] = await Promise.all([messageCounts(), inventoryCounts()]);
  const badges = { messages: msgs.unread, stock: stock.low + stock.out };
  const items = staff.mustChangePassword ? [] : NAV.filter((n) => can(staff.role, n.permission));
  return (
    <>
      <nav aria-label="Staff portal" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
        {items.map((n) => (
          <NavLink key={n.href} href={n.href} badge={n.badge ? badges[n.badge] : 0}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="hidden border-t border-green-800 px-4 py-4 text-sm lg:mt-auto lg:block">
        <p className="font-medium text-white">{staff.firstName} {staff.lastName}</p>
        <p className="text-xs text-green-200">{ROLE_LABELS[staff.role]} · {staff.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/change-password" className="text-xs text-green-100 underline underline-offset-2 hover:text-white">Change password</Link>
          <SignOutButton />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pb-3 text-xs text-green-100 lg:hidden">
        <span className="truncate">{staff.firstName} · {ROLE_LABELS[staff.role]}</span>
        <SignOutButton />
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-green-950 text-green-50 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between px-4 py-3 lg:py-5">
          <Link href="/admin" className="font-serif text-lg font-bold text-white">
            Book Worms <span className="ml-1 rounded bg-green-800 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide">Staff</span>
          </Link>
          <Link href="/" className="shrink-0 whitespace-nowrap text-xs text-green-200 underline underline-offset-2 hover:text-white">View store</Link>
        </div>
        <Suspense fallback={<div className="h-10" />}>
          <Nav />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
