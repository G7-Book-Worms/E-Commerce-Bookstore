import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listOrders, ORDER_STATUSES, STATUS_LABELS, type OrderSort } from '@/server/src/modules/orders/orders-admin';
import { Badge, EmptyState, ORDER_STATUS_BADGE, PageHeader, Pager, SortLink, Table, dateTime, inputCls, money, td, th } from '@/components/staff/ui';
import { FilterBar } from '@/components/staff/filter-bar';

export const metadata = { title: 'Orders' };
type SP = Record<string, string | undefined>;

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaffPage('orders.view');
  const sp = await searchParams;
  const sort = (['date', 'customer', 'total', 'status'].includes(sp.sort ?? '') ? sp.sort : 'date') as OrderSort;
  const result = await listOrders({ q: sp.q, status: sp.status, sort, dir: sp.dir === 'asc' ? 'asc' : 'desc', page: Number(sp.page) || 1 });
  const params = { q: sp.q, status: sp.status, sort: sp.sort, dir: sp.dir };

  return (
    <>
      <PageHeader title="Orders" description="Sort by any column. Click an order to ship, deliver or cancel it." />
      <FilterBar action="/admin/orders" q={sp.q} placeholder="Order #, customer name or email" hidden={{ sort: sp.sort, dir: sp.dir }}>
        <label className="sr-only" htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={sp.status ?? ''} className={`${inputCls} sm:w-44`}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </FilterBar>
      {result.rows.length === 0 ? (
        <EmptyState title="No orders match" text="Try a different search or status." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}><SortLink label="Date" column="date" params={params} basePath="/admin/orders" /></th>
              <th className={th}><SortLink label="Customer" column="customer" params={params} basePath="/admin/orders" /></th>
              <th className={th}>Items</th>
              <th className={th}><SortLink label="Status" column="status" params={params} basePath="/admin/orders" /></th>
              <th className={th}>Payment</th>
              <th className={`${th} text-right`}><SortLink label="Total" column="total" params={params} basePath="/admin/orders" /></th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((o) => (
              <tr key={o.orderId} className="hover:bg-stone-50">
                <td className={td}><Link href={`/admin/orders/${o.orderId}`} className="font-semibold text-green-900 underline-offset-2 hover:underline">#{o.orderId}</Link></td>
                <td className={`${td} whitespace-nowrap text-stone-600`}>{dateTime(o.created)}</td>
                <td className={td}><div className="font-medium">{o.customerName}</div><div className="text-xs text-stone-500">{o.email}</div></td>
                <td className={td}>{o.itemCount}</td>
                <td className={td}><Badge color={ORDER_STATUS_BADGE[o.status].color}>{ORDER_STATUS_BADGE[o.status].label}</Badge></td>
                <td className={`${td} text-xs text-stone-600`}>{o.paymentStatus ?? 'n/a'}</td>
                <td className={`${td} text-right font-medium`}>{money(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pager page={result.page} total={result.total} pageSize={result.pageSize} params={params} basePath="/admin/orders" />
    </>
  );
}

export default function OrdersPage(props: { searchParams: Promise<SP> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading orders…</p>}><Content {...props} /></Suspense>;
}
