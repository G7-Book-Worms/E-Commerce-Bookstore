// components/account/OrdersTab.tsx
'use client';

import React, { useState } from 'react';
import { UserOrder } from '@/lib/api/user';

interface Props {
  orders: UserOrder[];
  isLoading: boolean;
}

export const OrdersTab: React.FC<Props> = ({ orders, isLoading }) => {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const getStatusBadge = (status: UserOrder['status']) => {
    switch (status) {
      case 'arrived':
        return (
          <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-900">
            Delivered
          </span>
        );
      case 'transit':
        return (
          <span className="inline-flex items-center rounded-full border border-stone-300 bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-900">
            In Transit
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700">
            Pending Processing
          </span>
        );
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-stone-500 text-sm">Loading order history...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-12 text-center shadow-xs">
        <p className="text-stone-700 font-medium text-base">You haven't placed any book orders yet.</p>
        <a href="/" className="inline-block mt-4 text-sm font-semibold text-stone-900 hover:underline">
          Explore Bookstore Catalog &rarr;
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {orders.map((order) => {
        const isExpanded = expandedOrderId === order.orderId;
        return (
          <div key={order.orderId} className="bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-6 flex flex-wrap items-center justify-between gap-4 border-b border-stone-100">
              <div>
                <p className="text-xs font-mono font-semibold text-stone-500 uppercase tracking-wider">
                  Order #{order.orderId}
                </p>
                <p className="text-xl font-bold text-stone-900 mt-1">${order.totalCost}</p>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(order.status)}
                <button
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)}
                  className="h-9 px-4 rounded-md border border-stone-200 bg-white text-stone-900 hover:bg-stone-50 text-xs font-medium transition-colors"
                >
                  {isExpanded ? 'Hide Details' : 'View Details'}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="p-6 bg-stone-50 border-t border-stone-200 space-y-4 text-sm text-stone-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="font-semibold text-stone-500">SHIPPING DESTINATION ID:</span> {order.shippingAddressId}
                  </div>
                  {order.note && (
                    <div>
                      <span className="font-semibold text-stone-500">ORDER NOTE:</span> {order.note}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-stone-200/60">
                  <p className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2">Item Breakdown</p>
                  <p className="text-xs text-stone-500">
                    Standard shipment fulfilled from warehouse archive.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};