import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listCustomers, type CustomerSort } from '@/server/src/modules/users/customers-admin';
import { Badge, EmptyState, PageHeader, SortLink, Table, dateOnly, inputCls, money, td, th } from '@/components/staff/ui';
import { FilterBar } from '@/components/staff/filter-bar';

export const metadata = { title: 'Customers' };
type SP = Record<string, string | undefined>;

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaffPage('customers.view');
  const sp = await searchParams;
  const sort = (['name', 'joined', 'orders', 'spent'].includes(sp.sort ?? '') ? sp.sort : 'joined') as CustomerSort;
  const rows = await listCustomers({ q: sp.q, status: sp.status === 'active' || sp.status === 'inactive' ? sp.status : undefined, sort, dir: sp.dir === 'asc' ? 'asc' : 'desc' });
  const params = { q: sp.q, status: sp.status, sort: sp.sort, dir: sp.dir };
  return (
    <>
      <PageHeader title="Customers" description="Find an account to deactivate it, sign it out everywhere, or give a temporary password." />
      <FilterBar action="/admin/customers" q={sp.q} placeholder="Name, email or phone" hidden={{ sort: sp.sort, dir: sp.dir }}>
        <label className="sr-only" htmlFor="cstatus">Status</label>
        <select id="cstatus" name="status" defaultValue={sp.status ?? ''} className={`${inputCls} sm:w-40`}>
          <option value="">All accounts</option><option value="active">Active</option><option value="inactive">Deactivated</option>
        </select>
      </FilterBar>
      {rows.length === 0 ? <EmptyState title="No customers match" /> : (
        <Table>
          <thead><tr>
            <th className={th}><SortLink label="Name" column="name" params={params} basePath="/admin/customers" /></th>
            <th className={th}>Email</th>
            <th className={th}><SortLink label="Joined" column="joined" params={params} basePath="/admin/customers" /></th>
            <th className={th}><SortLink label="Orders" column="orders" params={params} basePath="/admin/customers" /></th>
            <th className={`${th} text-right`}><SortLink label="Spent" column="spent" params={params} basePath="/admin/customers" /></th>
            <th className={th}>Status</th>
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.userId} className="hover:bg-stone-50">
                <td className={td}><Link href={`/admin/customers/${c.userId}`} className="font-medium text-green-900 underline-offset-2 hover:underline">{c.firstName} {c.lastName}</Link></td>
                <td className={`${td} text-stone-600`}>{c.email}</td>
                <td className={`${td} whitespace-nowrap text-stone-600`}>{dateOnly(c.created)}</td>
                <td className={td}>{c.orderCount}</td>
                <td className={`${td} text-right`}>{money(c.spentCents)}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1">
                    {c.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Deactivated</Badge>}
                    {c.mustChangePassword && <Badge color="amber">Temp password</Badge>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export default function CustomersPage(props: { searchParams: Promise<SP> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}
