import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { getOrderDetail, NEXT_STATUSES, type OrderStatus } from '@/server/src/modules/orders/orders-admin';
import { shipmentView } from '@/server/src/modules/orders/carriers';
import { can } from '@/lib/staff-permissions';
import { Badge, ORDER_STATUS_BADGE, PageHeader, Panel, dateTime, money } from '@/components/staff/ui';
import { OrderStatusForm } from './status-form';

export const metadata = { title: 'Order' };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffPage('orders.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const detail = await getOrderDetail(id).catch(() => null);
  if (!detail) notFound();
  const { order, items, payment, address, customer, history } = detail;
  const status = order.status as OrderStatus;
  const shipment = shipmentView(order.trackingNumber);

  return (
    <>
      <Link href="/admin/orders" className="mb-3 inline-block text-sm text-stone-500 underline-offset-2 hover:underline">← All orders</Link>
      <PageHeader
        title={`Order #${order.orderId}`}
        description={`Placed ${dateTime(order.created)}`}
        actions={<Badge color={ORDER_STATUS_BADGE[status].color}>{ORDER_STATUS_BADGE[status].label}</Badge>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Items">
            <ul className="divide-y divide-stone-100 text-sm">
              {items.map((i) => (
                <li key={i.orderItemId} className="flex justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs text-stone-500">{i.author} · {i.format} · ISBN {i.isbn}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p>{i.quantity} × ${Number(i.unitPrice).toFixed(2)}</p>
                    <p className="font-medium">${(i.quantity * Number(i.unitPrice)).toFixed(2)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd>{money(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 && <div className="flex justify-between"><dt className="text-stone-500">Discount</dt><dd>−{money(order.discountCents)}</dd></div>}
              <div className="flex justify-between"><dt className="text-stone-500">Tax</dt><dd>{money(order.taxCents)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(order.priceCents)}</dd></div>
            </dl>
          </Panel>
          <Panel title="History">
            {history.length === 0 ? <p className="text-sm text-stone-500">No recorded events.</p> : (
              <ol className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.activityId} className="flex flex-wrap gap-x-3">
                    <span className="w-44 shrink-0 text-stone-500">{dateTime(h.created)}</span>
                    <span className="font-mono text-xs leading-5">{h.action}</span>
                    <span className="text-xs leading-5 text-stone-500">{h.actorType}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Update status">
            {can(staff.role, 'orders.update') ? (
              <OrderStatusForm orderId={order.orderId} status={status} next={NEXT_STATUSES[status]} trackingNumber={order.trackingNumber} />
            ) : <p className="text-sm text-stone-500">Your role can view orders but not change them.</p>}
          </Panel>
          <Panel title="Customer">
            {customer ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                <p className="text-stone-600">{customer.email}</p>
                {customer.phone && <p className="text-stone-600">{customer.phone}</p>}
                {can(staff.role, 'customers.view') && <Link href={`/admin/customers/${customer.userId}`} className="text-xs underline">View customer</Link>}
              </div>
            ) : <p className="text-sm text-stone-500">Account deleted</p>}
          </Panel>
          <Panel title="Ship to">
            {address ? (
              <address className="text-sm not-italic text-stone-700">{address.street}<br />{address.city}, {address.state} {address.zip}<br />{address.country}</address>
            ) : <p className="text-sm text-stone-500">No address</p>}
            {shipment && (
              <p className="mt-2 text-xs text-stone-500">
                {shipment.carrierLabel ?? 'Tracking'}: <span className="font-mono">{shipment.trackingNumber}</span>
                {shipment.trackingUrl && (
                  <>
                    {' · '}
                    <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      Track on {shipment.carrierLabel}
                    </a>
                  </>
                )}
              </p>
            )}
          </Panel>
          <Panel title="Payment">
            {payment ? (
              <div className="space-y-1 text-sm">
                <p>Stripe test payment · <span className="font-medium">{payment.status}</span></p>
                {payment.cardBrand && <p className="text-stone-600">{payment.cardBrand} ending {payment.cardLast4}</p>}
              </div>
            ) : <p className="text-sm text-stone-500">No payment recorded</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function OrderPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}
