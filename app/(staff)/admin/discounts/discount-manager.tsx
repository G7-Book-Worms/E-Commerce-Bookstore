'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, btnPrimary, btnSecondary, inputCls, money } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

interface Discount {
  id: number;
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  timesUsed: number;
  isActive: boolean;
}

const empty = { code: '', kind: 'percent' as 'percent' | 'amount', value: '10', startsAt: '', endsAt: '', maxUses: '', isActive: true };
const toLocal = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

function state(d: Discount) {
  const now = Date.now();
  if (!d.isActive) return <Badge>Off</Badge>;
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return <Badge color="red">Expired</Badge>;
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return <Badge color="blue">Scheduled</Badge>;
  if (d.maxUses !== null && d.timesUsed >= d.maxUses) return <Badge color="amber">Used up</Badge>;
  return <Badge color="green">Live</Badge>;
}

export function DiscountManager({ rows }: { rows: Discount[] }) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(d: Discount) {
    setEditing(d.id);
    setForm({
      code: d.code,
      kind: d.percentOff ? 'percent' : 'amount',
      value: d.percentOff ? String(d.percentOff) : ((d.amountOffCents ?? 0) / 100).toFixed(2),
      startsAt: toLocal(d.startsAt),
      endsAt: toLocal(d.endsAt),
      maxUses: d.maxUses ? String(d.maxUses) : '',
      isActive: d.isActive,
    });
    setMsg(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      code: form.code,
      kind: form.kind,
      value: Number(form.value),
      startsAt: form.startsAt ? `${form.startsAt}T00:00:00` : null,
      endsAt: form.endsAt ? `${form.endsAt}T23:59:59` : null,
      maxUses: form.maxUses ? Math.trunc(Number(form.maxUses)) : null,
      isActive: form.isActive,
    };
    const res = editing
      ? await staffFetch(`/api/staff/discounts/${editing}`, 'PUT', body)
      : await staffFetch('/api/staff/discounts', 'POST', body);
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) { setForm(empty); setEditing(null); router.refresh(); }
  }

  async function toggle(d: Discount) {
    const res = await staffFetch(`/api/staff/discounts/${d.id}`, 'PATCH', { isActive: !d.isActive });
    setMsg({ ok: res.ok, text: `${d.code}: ${res.message}` });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-stone-500">
            <tr><th className="py-2">Code</th><th>Discount</th><th>Dates</th><th>Uses</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-stone-100">
                <td className="py-2 font-mono font-semibold">{d.code}</td>
                <td>{d.percentOff ? `${d.percentOff}% off` : `${money(d.amountOffCents ?? 0)} off`}</td>
                <td className="text-xs text-stone-600">{d.startsAt || d.endsAt ? `${toLocal(d.startsAt) || 'now'} → ${toLocal(d.endsAt) || 'no end'}` : 'Always'}</td>
                <td>{d.timesUsed}{d.maxUses ? ` / ${d.maxUses}` : ''}</td>
                <td>{state(d)}</td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button type="button" className={btnSecondary} onClick={() => edit(d)}>Edit</button>
                    <button type="button" className={btnSecondary} onClick={() => toggle(d)}>{d.isActive ? 'Turn off' : 'Turn on'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={save} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h2 className="mb-3 text-sm font-semibold">{editing ? `Edit ${form.code}` : 'New discount code'}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm"><span className="mb-1 block font-medium">Code</span>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className={`${inputCls} font-mono uppercase`} placeholder="SPRING20" required /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Type</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'percent' | 'amount' })} className={inputCls}>
              <option value="percent">Percent off</option><option value="amount">Dollar amount off</option>
            </select></label>
          <label className="text-sm"><span className="mb-1 block font-medium">{form.kind === 'percent' ? 'Percent' : 'Dollars'}</span>
            <input type="number" step={form.kind === 'percent' ? 1 : 0.01} min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputCls} required /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Max uses (blank = unlimited)</span>
            <input type="number" min="1" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} className={inputCls} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Starts (optional)</span>
            <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={inputCls} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Ends (optional)</span>
            <input type="date" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className={inputCls} /></label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create code'}</button>
          {editing && <button type="button" className={btnSecondary} onClick={() => { setEditing(null); setForm(empty); }}>Cancel edit</button>}
        </div>
        {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
      </form>
    </div>
  );
}
