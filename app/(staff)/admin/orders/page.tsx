import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listOrders, NEXT_STATUSES, ORDER_STATUSES, STATUS_LABELS, type OrderSort, type OrderStatus } from '@/server/src/modules/orders/orders-admin';
import { can } from '@/lib/staff-permissions';
import { EmptyState, PageHeader, Pager, inputCls } from '@/components/staff/ui';
import { FilterBar } from '@/components/staff/filter-bar';
import { OrdersTable } from './orders-table';

export const metadata = { title: 'Orders' };
type SP = Record<string, string | undefined>;

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaffPage('orders.view');
  const sp = await searchParams;
  const sort = (['date', 'customer', 'total', 'status'].includes(sp.sort ?? '') ? sp.sort : 'date') as OrderSort;
  const result = await listOrders({ q: sp.q, status: sp.status, sort, dir: sp.dir === 'asc' ? 'asc' : 'desc', page: Number(sp.page) || 1 });
  const params = { q: sp.q, status: sp.status, sort: sp.sort, dir: sp.dir };
  // The legal next statuses are decided here, on the server, from the same table the API
  // enforces; the table only draws the buttons for them.
  const rows = result.rows.map((o) => ({ ...o, next: NEXT_STATUSES[o.status as OrderStatus] ?? [] }));
  const canUpdate = can(staff.role, 'orders.update');

  return (
    <>
      <PageHeader title="Orders" description="Click anywhere on a row to open an order, use the buttons on the right, or tick several and act on them together." />
      <FilterBar action="/admin/orders" q={sp.q} placeholder="Order #, customer name or email" hidden={{ sort: sp.sort, dir: sp.dir }}>
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={sp.status ?? ''} className={`${inputCls} sm:w-44`}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState title="No orders match" text="Try a different search or status." />
      ) : (
        <OrdersTable rows={rows} canUpdate={canUpdate} sortParams={params} />
      )}
      <Pager page={result.page} total={result.total} pageSize={result.pageSize} params={params} basePath="/admin/orders" />
    </>
  );
}

export default function OrdersPage(props: { searchParams: Promise<SP> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading orders…</p>}><Content {...props} /></Suspense>;
}
