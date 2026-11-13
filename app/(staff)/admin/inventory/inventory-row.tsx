'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, btnPrimary, btnSecondary, inputCls, money, td } from '@/components/staff/ui';
import { staffFetch } from '@/components/staff/staff-fetch';

interface Row {
  bookFormatId: number;
  bookId: number;
  title: string;
  author: string;
  isbn: string;
  format: string;
  priceCents: number;
  salePriceCents: number | null;
  stock: number;
  lowStockThreshold: number;
}

const toCents = (v: string) => Math.round(Number(v) * 100);

export function InventoryRow({ row, canStock, canManage }: { row: Row; canStock: boolean; canManage: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<null | 'stock' | 'price'>(null);
  const [kind, setKind] = useState<'restock' | 'adjustment'>('restock');
  const [qty, setQty] = useState('10');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState((row.priceCents / 100).toFixed(2));
  const [sale, setSale] = useState(row.salePriceCents ? (row.salePriceCents / 100).toFixed(2) : '');
  const [threshold, setThreshold] = useState(String(row.lowStockThreshold));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const status = row.stock === 0 ? <Badge color="red">Sold out</Badge> : row.stock <= row.lowStockThreshold ? <Badge color="amber">Low</Badge> : <Badge color="green">In stock</Badge>;

  async function saveStock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const n = Math.trunc(Number(qty));
    const res = await staffFetch(`/api/staff/inventory/${row.bookFormatId}`, 'POST', { kind, quantityChange: n, note: note || null });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) { setMode(null); setNote(''); router.refresh(); }
  }

  async function savePrice(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await staffFetch(`/api/staff/inventory/${row.bookFormatId}`, 'PATCH', {
      priceCents: toCents(price),
      salePriceCents: sale ? toCents(sale) : null,
      lowStockThreshold: Math.trunc(Number(threshold)),
    });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) { setMode(null); router.refresh(); }
  }

  const id = `inv-${row.bookFormatId}`;
  return (
    <>
      <tr className="hover:bg-stone-50">
        <td className={td}>
          {canManage ? (
            <Link href={`/admin/books/${row.bookId}`} className="font-medium text-green-900 underline-offset-2 hover:underline">{row.title}</Link>
          ) : <p className="font-medium">{row.title}</p>}
          <p className="text-xs text-stone-500">{row.author} · <span className="capitalize">{row.format}</span> · {row.isbn}</p>
        </td>
        <td className={`${td} whitespace-nowrap`}>
          {row.salePriceCents ? (
            <><span className="font-medium text-red-700">{money(row.salePriceCents)}</span> <s className="text-xs text-stone-400">{money(row.priceCents)}</s></>
          ) : money(row.priceCents)}
        </td>
        <td className={td}><div className="flex items-center gap-2"><span className="w-8 font-semibold">{row.stock}</span>{status}</div></td>
        <td className={td}>{row.lowStockThreshold}</td>
        <td className={`${td} text-right`}>
          <div className="flex justify-end gap-2">
            {canStock && <button type="button" className={btnSecondary} aria-expanded={mode === 'stock'} aria-controls={id} onClick={() => { setMode(mode === 'stock' ? null : 'stock'); setMsg(null); }}>Stock</button>}
            {canManage && <button type="button" className={btnSecondary} aria-expanded={mode === 'price'} aria-controls={id} onClick={() => { setMode(mode === 'price' ? null : 'price'); setMsg(null); }}>Price</button>}
          </div>
          {msg && !mode && <p role="status" className={`mt-1 text-xs ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
        </td>
      </tr>
      {mode && (
        <tr id={id} className="bg-stone-50">
          <td colSpan={5} className="border-b border-stone-200 px-3 py-3">
            {mode === 'stock' ? (
              <form onSubmit={saveStock} className="flex flex-wrap items-end gap-3">
                <fieldset className="flex gap-3 text-sm">
                  <legend className="sr-only">Type of change</legend>
                  <label className="flex items-center gap-1.5"><input type="radio" name={`kind-${id}`} checked={kind === 'restock'} onChange={() => { setKind('restock'); setQty('10'); }} /> Restock</label>
                  <label className="flex items-center gap-1.5"><input type="radio" name={`kind-${id}`} checked={kind === 'adjustment'} onChange={() => { setKind('adjustment'); setQty('-1'); }} /> Correct count</label>
                </fieldset>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">{kind === 'restock' ? 'Copies received' : 'Change (+/−)'}</span>
                  <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputCls} w-28`} min={kind === 'restock' ? 1 : undefined} required />
                </label>
                <label className="min-w-48 flex-1 text-sm">
                  <span className="mb-1 block font-medium">Note {kind === 'adjustment' ? '(required)' : '(optional)'}</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder={kind === 'restock' ? 'Supplier delivery' : 'Damaged copy, recount…'} maxLength={255} />
                </label>
                <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button type="button" className={btnSecondary} onClick={() => setMode(null)}>Cancel</button>
              </form>
            ) : (
              <form onSubmit={savePrice} className="flex flex-wrap items-end gap-3">
                <label className="text-sm"><span className="mb-1 block font-medium">Price ($)</span>
                  <input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} w-28`} required /></label>
                <label className="text-sm"><span className="mb-1 block font-medium">Sale price ($, blank = none)</span>
                  <input type="number" step="0.01" min="0.01" value={sale} onChange={(e) => setSale(e.target.value)} className={`${inputCls} w-36`} /></label>
                <label className="text-sm"><span className="mb-1 block font-medium">Low-stock alert at</span>
                  <input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={`${inputCls} w-28`} required /></label>
                <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button type="button" className={btnSecondary} onClick={() => setMode(null)}>Cancel</button>
              </form>
            )}
            {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
