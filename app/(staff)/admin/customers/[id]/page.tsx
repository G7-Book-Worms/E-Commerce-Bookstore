import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { getCustomer } from '@/server/src/modules/users/customers-admin';
import { isAnonymised } from '@/server/src/modules/staff/staff-guards';
import { can } from '@/lib/staff-permissions';
import { Badge, ORDER_STATUS_BADGE, PageHeader, Panel, dateOnly, dateTime, money } from '@/components/staff/ui';
import { CustomerActions } from './customer-actions';
import { CustomerDetailsForm } from './details-form';

export const metadata = { title: 'Customer' };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage('customers.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const data = await getCustomer(id).catch(() => null);
  if (!data) notFound();
  const { user, addresses, orders } = data;
  // What this role may do is enforced by the API for every request; these two flags only decide
  // which controls are drawn. An employee answering a ticket can correct details and send a reset
  // link (customers.edit); everything destructive needs customers.manage.
  const canEdit = can(staff.role, 'customers.edit');
  const canManage = can(staff.role, 'customers.manage');
  const anonymised = isAnonymised(user.email);
  return (
    <>
      <Link href="/admin/customers" className="mb-3 inline-block text-sm text-stone-500 underline-offset-2 hover:underline">← All customers</Link>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={anonymised ? `Deleted account · joined ${dateOnly(user.created)}` : `${user.email} · joined ${dateOnly(user.created)}`}
        actions={<div className="flex gap-1">{anonymised ? <Badge color="gray">Deleted</Badge> : user.isActive ? <Badge color="green">Active</Badge> : <Badge color="red">Deactivated</Badge>}{user.mustChangePassword && <Badge color="amber">Must reset</Badge>}</div>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title={`Orders (${orders.length})`} className="xl:col-span-2">
          {orders.length === 0 ? <p className="text-sm text-stone-500">No orders yet.</p> : (
            <ul className="divide-y divide-stone-100 text-sm">
              {orders.map((o) => (
                <li key={o.orderId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/orders/${o.orderId}`} className="font-medium underline-offset-2 hover:underline">#{o.orderId}</Link>
                  <span className="flex-1 text-stone-500">{dateTime(o.created)}</span>
                  <Badge color={ORDER_STATUS_BADGE[o.status].color}>{ORDER_STATUS_BADGE[o.status].label}</Badge>
                  <span className="w-20 text-right">{money(o.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title="Account actions">
            {canEdit
              ? <CustomerActions userId={user.userId} isActive={user.isActive} name={user.firstName} canManage={canManage} anonymised={anonymised} />
              : <p className="text-sm text-stone-500">View only.</p>}
          </Panel>
          <Panel title="Details">
            {canEdit && !anonymised ? (
              <CustomerDetailsForm userId={user.userId} initial={{ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone }} />
            ) : (
              <><p className="text-sm">{user.email}</p><p className="text-sm text-stone-600">{user.phone ?? 'No phone'}</p></>
            )}
          </Panel>
          <Panel title="Addresses">
            {addresses.length === 0 ? <p className="text-sm text-stone-500">None saved.</p> : (
              <ul className="space-y-2 text-sm">
                {addresses.map((a) => (
                  <li key={a.addressId}>{a.street}, {a.city}, {a.state} {a.zip} {a.isDefault && <Badge>Default</Badge>}</li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function CustomerPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}
