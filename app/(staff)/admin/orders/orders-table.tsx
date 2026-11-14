'use client';

// The orders table (session 4).
//
// The complaint this fixes: the only way into an order was the small "#123" link in the
// left-most column. Now the whole row leads to the order, every row carries visible action
// buttons, and the checkboxes drive a bulk action bar.
//
// Keyboard and screen-reader notes, since a clickable row is easy to get wrong:
//  * The "#123" link is still a real <Link>, so Tab order and "open in new tab" are unchanged
//    and a screen reader still announces a link. The row's onClick is an extra for mouse
//    users, not the only way through — there is no tabIndex or role on the <tr>, so the row
//    is never announced as a button and never becomes a focus trap.
//  * A click that lands on a checkbox, button or link inside the row does not also navigate.
//  * Every checkbox and icon button has its own label naming the order number.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, ORDER_STATUS_BADGE, SortLink, Table, btnDanger, btnPrimary, btnSecondary, dateTime, inputCls, money, td, th } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import {
  CARRIERS,
  CARRIER_LABELS,
  normalizeTrackingNumber,
  validateTrackingNumber,
  type Carrier,
} from '@/server/src/modules/orders/carriers';

export interface OrderRow {
  orderId: number;
  created: Date | string;
  status: string;
  totalCents: number;
  customerName: string;
  email: string | null;
  itemCount: number;
  paymentStatus: string | null;
  /** Statuses this order may legally move to, worked out on the server */
  next: string[];
}

const ACTION_LABEL: Record<string, string> = { transit: 'Ship', arrived: 'Delivered', cancelled: 'Cancel' };
const BULK_LABEL: Record<string, string> = { transit: 'Mark shipped', arrived: 'Mark delivered', cancelled: 'Cancel orders' };
const BULK_LIMIT = 50;

/** Did this click land on something that handles its own clicks? */
function onInteractive(target: EventTarget | null) {
  return target instanceof Element && target.closest('a,button,input,select,label,textarea') !== null;
}

export function OrdersTable({
  rows,
  canUpdate,
  sortParams,
}: {
  rows: OrderRow[];
  canUpdate: boolean;
  /** Current q/status/sort/dir, so the sortable column headers keep the other filters */
  sortParams: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Which single order is being shipped: shipping asks for a carrier and tracking number
  const [shipping, setShipping] = useState<OrderRow | null>(null);

  const selectableIds = useMemo(() => rows.filter((r) => r.next.length > 0).map((r) => r.orderId), [rows]);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  // Only offer a bulk action every selected order could actually take
  const bulkActions = useMemo(() => {
    const chosen = rows.filter((r) => selected.has(r.orderId));
    if (chosen.length === 0) return [];
    return (['transit', 'arrived', 'cancelled'] as const).filter((s) => chosen.every((r) => r.next.includes(s)));
  }, [rows, selected]);

  function toggle(orderId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds.slice(0, BULK_LIMIT)));
  }

  async function runSingle(order: OrderRow, status: string, extra?: { carrier: string | null; trackingNumber: string | null }) {
    if (status === 'cancelled' && !window.confirm(`Cancel order #${order.orderId}? The copies go back into stock and the customer is emailed.`)) return;
    setBusy(true);
    const res = await staffFetch(`/api/staff/orders/${order.orderId}`, 'PATCH', { status, ...extra });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      setShipping(null);
      router.refresh();
    }
  }

  async function runBulk(status: string) {
    const ids = [...selected];
    const what = BULK_LABEL[status].toLowerCase();
    if (!window.confirm(`${what.charAt(0).toUpperCase()}${what.slice(1)} — ${ids.length} order${ids.length === 1 ? '' : 's'}? The customers are emailed.`)) return;
    setBusy(true);
    const res = await staffFetch('/api/staff/orders/bulk', 'PATCH', { orderIds: ids, status });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      setSelected(new Set());
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {/* Bulk action bar: only appears once something is ticked */}
      {canUpdate && selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2"
        >
          <p aria-live="polite" className="text-sm font-medium text-green-900">
            {selected.size} order{selected.size === 1 ? '' : 's'} selected
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            {bulkActions.length === 0 ? (
              <p className="text-xs text-green-900">No action applies to all of these.</p>
            ) : (
              bulkActions.map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => runBulk(s)} className={s === 'cancelled' ? btnDanger : btnPrimary}>
                  {BULK_LABEL[s]}
                </button>
              ))
            )}
            <button type="button" onClick={() => setSelected(new Set())} className={btnSecondary}>Clear</button>
          </div>
        </div>
      )}

      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>
      )}

      <Table>
        <thead>
          <tr>
            {canUpdate && (
              <th className={`${th} w-10`}>
                <input
                  type="checkbox"
                  className="size-4 align-middle accent-green-900"
                  checked={allSelected}
                  disabled={selectableIds.length === 0}
                  onChange={toggleAll}
                  aria-label={allSelected ? 'Clear selection' : 'Select every order that can be changed'}
                />
              </th>
            )}
            <th className={th}>Order</th>
            <th className={th}><SortLink label="Date" column="date" params={sortParams} basePath="/admin/orders" /></th>
            <th className={th}><SortLink label="Customer" column="customer" params={sortParams} basePath="/admin/orders" /></th>
            <th className={th}>Items</th>
            <th className={th}><SortLink label="Status" column="status" params={sortParams} basePath="/admin/orders" /></th>
            <th className={th}>Payment</th>
            <th className={`${th} text-right`}><SortLink label="Total" column="total" params={sortParams} basePath="/admin/orders" /></th>
            <th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const href = `/admin/orders/${o.orderId}`;
            return (
              <tr
                key={o.orderId}
                // Mouse convenience only — the link in the first cell is the real navigation
                onClick={(e) => {
                  if (onInteractive(e.target)) return;
                  router.push(href);
                }}
                className={`cursor-pointer transition-colors hover:bg-stone-50 focus-within:bg-stone-50 ${selected.has(o.orderId) ? 'bg-green-50/60' : ''}`}
              >
                {canUpdate && (
                  <td className={td}>
                    <input
                      type="checkbox"
                      className="size-4 align-middle accent-green-900"
                      checked={selected.has(o.orderId)}
                      disabled={o.next.length === 0}
                      onChange={() => toggle(o.orderId)}
                      aria-label={`Select order #${o.orderId}`}
                    />
                  </td>
                )}
                <td className={td}>
                  <Link href={href} className="font-semibold text-green-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800">
                    #{o.orderId}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-stone-600`}>{dateTime(o.created)}</td>
                <td className={td}>
                  <div className="font-medium">{o.customerName}</div>
                  <div className="text-xs text-stone-500">{o.email}</div>
                </td>
                <td className={td}>{o.itemCount}</td>
                <td className={td}><Badge color={ORDER_STATUS_BADGE[o.status].color}>{ORDER_STATUS_BADGE[o.status].label}</Badge></td>
                <td className={`${td} text-xs text-stone-600`}>{o.paymentStatus ?? 'n/a'}</td>
                <td className={`${td} text-right font-medium`}>{money(o.totalCents)}</td>
                <td className={td}>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {canUpdate &&
                      o.next.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() => (s === 'transit' ? setShipping(o) : runSingle(o, s))}
                          className={`${s === 'cancelled' ? btnDanger : btnSecondary} h-8 px-2 text-xs`}
                          aria-label={`${ACTION_LABEL[s]} order #${o.orderId}`}
                        >
                          {ACTION_LABEL[s]}
                          {s === 'transit' ? '…' : ''}
                        </button>
                      ))}
                    <Link href={href} className={`${btnSecondary} h-8 px-2 text-xs`} aria-label={`Open order #${o.orderId}`}>
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {shipping && (
        <ShipDialog
          order={shipping}
          busy={busy}
          onCancel={() => setShipping(null)}
          onConfirm={(carrier, trackingNumber) => runSingle(shipping, 'transit', { carrier, trackingNumber })}
        />
      )}
    </div>
  );
}

/**
 * Asks for the carrier and tracking number before an order is marked shipped. The number is
 * checked as it is typed with the same pure function the API validates with.
 */
function ShipDialog({
  order,
  busy,
  onCancel,
  onConfirm,
}: {
  order: OrderRow;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (carrier: string | null, trackingNumber: string | null) => void;
}) {
  const [carrier, setCarrier] = useState<Carrier | ''>('');
  const [tracking, setTracking] = useState('');

  const typed = normalizeTrackingNumber(tracking) !== '';
  const check = typed ? validateTrackingNumber(carrier || null, tracking) : { ok: true };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ship-title"
        className="w-full max-w-sm space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
      >
        <h2 id="ship-title" className="font-serif text-lg font-bold">Ship order #{order.orderId}</h2>
        <div className="space-y-1.5">
          <label htmlFor="ship-carrier" className="text-sm font-medium">Carrier</label>
          <select id="ship-carrier" autoFocus value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier | '')} className={inputCls}>
            <option value="">Select a carrier…</option>
            {CARRIERS.map((c) => <option key={c} value={c}>{CARRIER_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ship-tracking" className="text-sm font-medium">Tracking number</label>
          <input
            id="ship-tracking"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            className={inputCls}
            aria-invalid={typed && !check.ok}
            aria-describedby="ship-help"
          />
          <p id="ship-help" className={`text-xs ${typed && !check.ok ? 'text-red-700' : 'text-stone-500'}`} role={typed && !check.ok ? 'alert' : undefined}>
            {typed && !check.ok ? (check as { error?: string }).error : 'Optional, but the customer gets no tracking link without it.'}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
          <button
            type="button"
            disabled={busy || (typed && !check.ok)}
            onClick={() => onConfirm(carrier || null, tracking || null)}
            className={btnPrimary}
          >
            Mark shipped
          </button>
        </div>
      </div>
    </div>
  );
}
