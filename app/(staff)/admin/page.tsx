import Link from 'next/link';
import { Suspense } from 'react';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { can, ROLE_LABELS } from '@/lib/staff-permissions';
import { dailySales, listOrders, orderStats, topSellers } from '@/server/src/modules/orders/orders-admin';
import { inventoryCounts, listInventory } from '@/server/src/modules/inventory/inventory-service';
import { messageCounts } from '@/server/src/modules/contact/contact-service';
import { Badge, ORDER_STATUS_BADGE, PageHeader, Panel, StatCard, dateTime, money } from '@/components/staff/ui';
import { SalesChart } from '@/components/staff/sales-chart';

export const metadata = { title: 'Dashboard' };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requireStaffPage('dashboard.view');
  const sp = await searchParams;
  const [stats, sales, stock, lowRows, msgs, recent, sellers, [{ customers }]] = await Promise.all([
    orderStats(),
    dailySales(14),
    inventoryCounts(),
    listInventory({ filter: 'low', sort: 'stock', dir: 'asc' }),
    messageCounts(),
    listOrders({ sort: 'date', dir: 'desc' }),
    topSellers(5),
    db.select({ customers: sql<number>`COUNT(*)` }).from(users),
  ]);

  return (
    <>
      {sp.denied && (
        <p role="alert" className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Your role ({ROLE_LABELS[staff.role]}) can&apos;t open that page.
        </p>
      )}
      <PageHeader title={`Hi, ${staff.firstName}`} description="Store overview. Abandoned checkouts are left out of every number." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={money(stats.revenueCents)} hint="All placed orders (test payments)" />
        <StatCard label="Orders" value={stats.placed} hint={`${stats.last30} in the last 30 days`} href="/admin/orders" />
        <StatCard label="To ship" value={stats.toShip} hint="Processing" href="/admin/orders?status=pending" tone={stats.toShip ? 'warn' : 'default'} />
        <StatCard label="Low stock" value={stock.low} hint={`${stock.out} sold out`} href="/admin/inventory?filter=low" tone={stock.out ? 'bad' : stock.low ? 'warn' : 'default'} />
        <StatCard label="New messages" value={msgs.unread} hint={`${msgs.open} open`} href="/admin/messages" tone={msgs.unread ? 'warn' : 'default'} />
        <StatCard label="Customers" value={Number(customers)} href={can(staff.role, 'customers.view') ? '/admin/customers' : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Sales, last 14 days" className="xl:col-span-2">
          <SalesChart data={sales} />
        </Panel>
        <Panel title="Low stock alerts" actions={<Link href="/admin/inventory?filter=low" className="text-xs underline">Inventory</Link>}>
          {lowRows.length === 0 ? (
            <p className="text-sm text-stone-500">Everything is above its alert level.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {lowRows.slice(0, 8).map((r) => (
                <li key={r.bookFormatId} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">{r.title} <span className="text-stone-400">({r.format})</span></span>
                  <Badge color={r.stock === 0 ? 'red' : 'amber'}>{r.stock === 0 ? 'Sold out' : `${r.stock} left`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Recent orders" className="xl:col-span-2" actions={<Link href="/admin/orders" className="text-xs underline">All orders</Link>}>
          {recent.rows.length === 0 ? <p className="text-sm text-stone-500">No orders yet.</p> : (
            <ul className="divide-y divide-stone-100 text-sm">
              {recent.rows.slice(0, 6).map((o) => (
                <li key={o.orderId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/orders/${o.orderId}`} className="font-medium underline-offset-2 hover:underline">#{o.orderId}</Link>
                  <span className="min-w-0 flex-1 truncate text-stone-600">{o.customerName}</span>
                  <span className="text-stone-500">{dateTime(o.created)}</span>
                  <Badge color={ORDER_STATUS_BADGE[o.status].color}>{ORDER_STATUS_BADGE[o.status].label}</Badge>
                  <span className="w-20 text-right font-medium">{money(o.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Best sellers">
          {sellers.length === 0 ? <p className="text-sm text-stone-500">No sales yet.</p> : (
            <ol className="space-y-2 text-sm">
              {sellers.map((s, i) => (
                <li key={s.bookId} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate"><span className="text-stone-400">{i + 1}.</span> {s.title}</span>
                  <span className="shrink-0 text-stone-600">{s.copies} sold</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function DashboardPage(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
