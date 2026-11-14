// components/account/OrdersTab.tsx
'use client';

import React, { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import Link from 'next/link';
import { UserOrder } from '@/lib/api/user';
import { formatPrice } from '@/lib/catalog';
import { OrderTracker } from './OrderTracker';

interface Props {
  orders: UserOrder[];
  isLoading: boolean;
}

const STATUS: Record<UserOrder['status'], { label: string; className: string }> = {
  pending: { label: 'Processing', className: 'border-stone-200 bg-white text-stone-700' },
  transit: { label: 'Shipped', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  arrived: { label: 'Delivered', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  cancelled: { label: 'Cancelled', className: 'border-red-200 bg-red-50 text-red-700' },
};

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });
const cents = (dollars: string) => Math.round(Number(dollars) * 100);

export const OrdersTab: React.FC<Props> = ({ orders, isLoading }) => {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  if (isLoading) {
    return <div className="p-12 text-center text-stone-500 text-sm">Loading order history...</div>;
  }

  if (orders.length === 0) {
    return (
      <EmptyState image="orders" title="No orders yet">
        <p>Once you check out, your orders show up here.</p>
        <Link href="/product-catalog" className="inline-block mt-4 text-sm font-semibold text-stone-900 hover:underline">
          Browse books &rarr;
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {orders.map((order) => {
        const isExpanded = expandedOrderId === order.orderId;
        const status = STATUS[order.status] ?? STATUS.pending;
        // Older orders were saved before subtotal/tax were stored
        const hasBreakdown = order.subtotalCents > 0;
        return (
          <div key={order.orderId} className="bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Order #{order.orderId} · {dateFmt.format(new Date(order.created))}
                </p>
                <p className="text-xl font-bold text-stone-900 mt-1">
                  {formatPrice(order.priceCents)}
                  <span className="ml-2 text-sm font-normal text-stone-500">
                    {order.totalItems} item{order.totalItems === 1 ? '' : 's'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}>
                  {status.label}
                </span>
                <button
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)}
                  aria-expanded={isExpanded}
                  className="h-9 px-4 rounded-md border border-stone-200 bg-white text-stone-900 hover:bg-stone-50 text-xs font-medium transition-colors"
                >
                  {isExpanded ? 'Hide details' : 'View details'}
                </button>
              </div>
            </div>

            {/* Where this order has got to, always visible: the tracker, the tracking number
                and a link to the carrier's own page (session 4) */}
            <div className="border-t border-stone-200 px-5 pb-5 pt-4 sm:px-6">
              <OrderTracker status={order.status} trackingNumber={order.trackingNumber} orderId={order.orderId} />
            </div>

            {isExpanded && (
              <div className="p-5 sm:p-6 bg-stone-50 border-t border-stone-200 grid gap-6 md:grid-cols-[1fr_260px] text-sm text-stone-700">
                <div>
                  <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">Items</p>
                  <ul className="divide-y divide-stone-200">
                    {order.items.map((item) => (
                      <li key={item.orderItemId} className="flex justify-between gap-4 py-2">
                        <span>
                          {item.isbn ? (
                            <Link href={`/product/${encodeURIComponent(item.isbn)}`} className="font-medium hover:underline">
                              {item.title}
                            </Link>
                          ) : (
                            <span className="font-medium">{item.title ?? `Book #${item.bookId}`}</span>
                          )}
                          <span className="block text-xs text-stone-500">
                            {item.author}
                            {item.format ? ` · ${item.format === 'hardcover' ? 'Hardcover' : 'Paperback'}` : ''} · Qty {item.quantity}
                          </span>
                        </span>
                        <span className="whitespace-nowrap">{formatPrice(cents(item.unitPrice) * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  {hasBreakdown && (
                    <dl className="space-y-1">
                      <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotalCents)}</dd></div>
                      {order.discountCents > 0 && (
                        <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>−{formatPrice(order.discountCents)}</dd></div>
                      )}
                      <div className="flex justify-between"><dt>Tax (8.25%)</dt><dd>{formatPrice(order.taxCents)}</dd></div>
                      <div className="flex justify-between border-t border-stone-200 pt-1 font-semibold text-stone-900"><dt>Total</dt><dd>{formatPrice(order.priceCents)}</dd></div>
                    </dl>
                  )}
                  {order.address && (
                    <div>
                      <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">Ship to</p>
                      <p className="mt-1">{order.address.street}<br />{order.address.city}, {order.address.state} {order.address.zip}</p>
                    </div>
                  )}
                  {order.payment?.cardLast4 && (
                    <div>
                      <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">Paid with</p>
                      <p className="mt-1">
                        <span className="capitalize">{order.payment.cardBrand}</span> ending {order.payment.cardLast4}
                        {order.payment.status === 'refunded' && <span className="ml-1 text-stone-500">(test charge refunded)</span>}
                      </p>
                    </div>
                  )}
                  {order.note && (
                    <div>
                      <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">Note</p>
                      <p className="mt-1">{order.note}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
