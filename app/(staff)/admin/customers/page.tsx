import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listCustomers, type CustomerSort } from '@/server/src/modules/users/customers-admin';
import { MAX_BULK } from '@/server/src/modules/staff/staff-guards';
import { can } from '@/lib/staff-permissions';
import { EmptyState, PageHeader, inputCls } from '@/components/staff/ui';
import { FilterBar } from '@/components/staff/filter-bar';
import { CustomersTable } from './customers-table';

export const metadata = { title: 'Customers' };
type SP = Record<string, string | undefined>;

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  // customers.view gets an employee onto the page. What they may actually do is decided per action
  // by the API; the `can` check below only decides what is worth drawing.
  const staff = await requireStaffPage('customers.view');
  const canManage = can(staff.role, 'customers.manage');
  const sp = await searchParams;
  const sort = (['name', 'joined', 'orders', 'spent'].includes(sp.sort ?? '') ? sp.sort : 'joined') as CustomerSort;
  const rows = await listCustomers({ q: sp.q, status: sp.status === 'active' || sp.status === 'inactive' ? sp.status : undefined, sort, dir: sp.dir === 'asc' ? 'asc' : 'desc' });
  const params = { q: sp.q, status: sp.status, sort: sp.sort, dir: sp.dir };
  // Dates are serialised here because the table is a client component.
  const plain = rows.map((r) => ({ ...r, created: r.created.toISOString() }));
  return (
    <>
      <PageHeader
        title="Customers"
        description={canManage
          ? 'Select accounts to deactivate, reactivate, force a password reset or delete them. Deleting removes the personal details and keeps the order history.'
          : 'Find an account to see its orders and correct its contact details.'}
      />
      <FilterBar action="/admin/customers" q={sp.q} placeholder="Name, email or phone" hidden={{ sort: sp.sort, dir: sp.dir }}>
        <label className="sr-only" htmlFor="cstatus">Status</label>
        <select id="cstatus" name="status" defaultValue={sp.status ?? ''} className={`${inputCls} sm:w-40`}>
          <option value="">All accounts</option><option value="active">Active</option><option value="inactive">Deactivated</option>
        </select>
      </FilterBar>
      {rows.length === 0
        ? <EmptyState title="No customers match" />
        : <CustomersTable rows={plain} params={params} canManage={canManage} maxBulk={MAX_BULK} />}
    </>
  );
}

export default function CustomersPage(props: { searchParams: Promise<SP> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}
