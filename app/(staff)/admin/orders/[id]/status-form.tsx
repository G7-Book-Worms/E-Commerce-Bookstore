'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnDanger, btnPrimary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';
import {
  CARRIERS,
  CARRIER_LABELS,
  normalizeTrackingNumber,
  parseShipment,
  validateTrackingNumber,
  type Carrier,
} from '@/server/src/modules/orders/carriers';

const LABEL: Record<string, string> = { transit: 'Mark as shipped', arrived: 'Mark as delivered', cancelled: 'Cancel order' };

const PLACEHOLDER: Record<Carrier, string> = {
  ups: '1Z999AA10123456784',
  fedex: '390123456789',
  usps: '9400 1234 5678 9012 3456',
  dhl: '1234567890',
};

export function OrderStatusForm({ orderId, status, next, trackingNumber }: { orderId: number; status: string; next: string[]; trackingNumber: string | null }) {
  const router = useRouter();
  // Whatever is already stored carries its carrier with it, so an edit starts where it left off
  const stored = parseShipment(trackingNumber);
  const [carrier, setCarrier] = useState<Carrier | ''>(stored?.carrier ?? '');
  const [tracking, setTracking] = useState(stored?.trackingNumber ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const typed = normalizeTrackingNumber(tracking) !== '';
  // Checked as you type with the same function the API uses, so a paste error is caught
  // before the request goes out
  const check = typed ? validateTrackingNumber(carrier || null, tracking) : { ok: true, value: '' };

  async function go(to: string) {
    if (to === 'cancelled' && !window.confirm(`Cancel order #${orderId}? The copies go back into stock and the customer is emailed.`)) return;
    if (to === 'transit' && typed && !check.ok) {
      setMsg({ ok: false, text: check.error ?? 'Check the tracking number' });
      return;
    }
    if (to === 'transit' && !typed && !window.confirm('Mark this order shipped with no tracking number? The customer will not get a tracking link.')) return;

    setBusy(true);
    const res = await staffFetch(`/api/staff/orders/${orderId}`, 'PATCH', {
      status: to,
      carrier: carrier || null,
      trackingNumber: tracking || null,
    });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) router.refresh();
  }

  if (next.length === 0) {
    return <p className="text-sm text-stone-500">This order is {status === 'cancelled' ? 'cancelled' : 'delivered'}; there is nothing left to do.</p>;
  }

  return (
    <div className="space-y-3">
      {next.includes('transit') && (
        <>
          <div className="space-y-1.5">
            <label htmlFor="carrier" className="text-sm font-medium">Carrier</label>
            <select
              id="carrier"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value as Carrier | '')}
              className={inputCls}
            >
              <option value="">Select a carrier…</option>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>{CARRIER_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tracking" className="text-sm font-medium">Tracking number</label>
            <input
              id="tracking"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className={inputCls}
              placeholder={carrier ? PLACEHOLDER[carrier] : 'Choose a carrier first'}
              aria-invalid={typed && !check.ok}
              aria-describedby="tracking-help"
            />
            <p id="tracking-help" className={`text-xs ${typed && !check.ok ? 'text-red-700' : 'text-stone-500'}`} role={typed && !check.ok ? 'alert' : undefined}>
              {typed && !check.ok
                ? check.error
                : 'The real number from the carrier. Spaces and dashes are fine. Leave both blank to ship without tracking.'}
            </p>
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {next.map((to) => (
          <button
            key={to}
            type="button"
            disabled={busy || (to === 'transit' && typed && !check.ok)}
            onClick={() => go(to)}
            className={to === 'cancelled' ? btnDanger : btnPrimary}
          >
            {LABEL[to]}
          </button>
        ))}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
