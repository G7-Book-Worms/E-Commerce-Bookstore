'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnDanger, btnPrimary, inputCls } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

const LABEL: Record<string, string> = { transit: 'Mark as shipped', arrived: 'Mark as delivered', cancelled: 'Cancel order' };

export function OrderStatusForm({ orderId, status, next, trackingNumber }: { orderId: number; status: string; next: string[]; trackingNumber: string | null }) {
  const router = useRouter();
  const [tracking, setTracking] = useState(trackingNumber ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(to: string) {
    if (to === 'cancelled' && !window.confirm(`Cancel order #${orderId}? The copies go back into stock and the customer is emailed.`)) return;
    setBusy(true);
    const res = await staffFetch(`/api/staff/orders/${orderId}`, 'PATCH', { status: to, trackingNumber: tracking || null });
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
        <div className="space-y-1.5">
          <label htmlFor="tracking" className="text-sm font-medium">Tracking number (optional)</label>
          <input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} className={inputCls} placeholder="1Z999AA10123456784" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {next.map((to) => (
          <button key={to} type="button" disabled={busy} onClick={() => go(to)} className={to === 'cancelled' ? btnDanger : btnPrimary}>
            {LABEL[to]}
          </button>
        ))}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
}
