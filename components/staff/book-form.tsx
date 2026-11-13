'use client';

// Add / edit a book (DemoCheckList items 10 and 16).
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { btnPrimary, btnSecondary, inputCls } from './ui';
import { staffFetch } from './staff-fetch';

const TAG_LABELS: Record<string, string> = {
  bestseller: 'Bestseller', 'new-release': 'New release', 'coming-soon': 'Coming soon', 'special-edition': 'Exclusive',
  trending: 'Trending', 'paperback-pick': 'Paperback pick', fiction: 'Fiction', nonfiction: 'Nonfiction',
  fantasy: 'Fantasy', history: 'History', science: 'Science', technology: 'Technology',
};

type FormatRow = { format: 'hardcover' | 'paperback'; enabled: boolean; price: string; sale: string; stock: string; threshold: string };
export interface BookFormProps {
  mode: 'create' | 'edit';
  bookId?: number;
  isbn?: string;
  categories: { categoryId: number; name: string }[];
  initial?: { title: string; author: string; description: string; categoryId: number | null; coverImageUrl: string | null; tags: string[] };
  existingFormats?: string[];
}

const blankFormat = (format: 'hardcover' | 'paperback', enabled: boolean): FormatRow => ({
  format, enabled, price: format === 'hardcover' ? '24.99' : '14.99', sale: '', stock: '10', threshold: '5',
});
const toCents = (v: string) => Math.round(Number(v) * 100);

export function BookForm({ mode, bookId, isbn: isbnInit = '', categories, initial, existingFormats = [] }: BookFormProps) {
  const router = useRouter();
  const [f, setF] = useState({
    isbn: isbnInit,
    title: initial?.title ?? '',
    author: initial?.author ?? '',
    description: initial?.description ?? '',
    categoryId: initial?.categoryId ? String(initial.categoryId) : '',
    coverImageUrl: initial?.coverImageUrl ?? '',
    tags: new Set(initial?.tags ?? ['new-release']),
  });
  const missing = (['hardcover', 'paperback'] as const).filter((x) => !existingFormats.includes(x));
  const [formats, setFormats] = useState<FormatRow[]>(
    mode === 'create' ? [blankFormat('hardcover', true), blankFormat('paperback', true)] : missing.map((m) => blankFormat(m, false))
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const setFormat = (i: number, patch: Partial<FormatRow>) => setFormats((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggleTag = (t: string) => setF((p) => { const tags = new Set(p.tags); if (tags.has(t)) tags.delete(t); else tags.add(t); return { ...p, tags }; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fmt = formats.filter((r) => r.enabled).map((r) => ({
      format: r.format,
      priceCents: toCents(r.price),
      salePriceCents: r.sale ? toCents(r.sale) : null,
      stock: Math.trunc(Number(r.stock) || 0),
      lowStockThreshold: Math.trunc(Number(r.threshold) || 0),
    }));
    const details = {
      title: f.title,
      author: f.author,
      description: f.description,
      categoryId: f.categoryId ? Number(f.categoryId) : null,
      coverImageUrl: f.coverImageUrl,
      tags: [...f.tags],
    };
    const res = mode === 'create'
      ? await staffFetch<{ bookId: number }>('/api/staff/books', 'POST', { ...details, isbn: f.isbn, formats: fmt })
      : await staffFetch(`/api/staff/books/${bookId}`, 'PUT', { ...details, ...(fmt[0] ? { addFormat: fmt[0] } : {}) });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.message });
    if (res.ok) {
      if (mode === 'create') router.push(`/admin/inventory?q=${encodeURIComponent(f.isbn)}`);
      else router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        {mode === 'create' ? (
          <label className="text-sm"><span className="mb-1 block font-medium">ISBN-13</span>
            <input required value={f.isbn} onChange={(e) => setF({ ...f, isbn: e.target.value })} className={`${inputCls} font-mono`} placeholder="978-0-00-000031-0" /></label>
        ) : (
          <p className="text-sm"><span className="mb-1 block font-medium">ISBN-13</span><span className="font-mono">{isbnInit}</span> <Link className="ml-2 text-xs underline" href={`/product/${encodeURIComponent(isbnInit)}`}>View in store</Link></p>
        )}
        <label className="text-sm"><span className="mb-1 block font-medium">Category</span>
          <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className={inputCls}>
            <option value="">None</option>
            {categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.name}</option>)}
          </select></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Title</span>
          <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} maxLength={200} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Author</span>
          <input required value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} className={inputCls} maxLength={100} /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Description</span>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} maxLength={5000}
            className="w-full rounded-md border border-stone-300 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800" /></label>
        <label className="text-sm md:col-span-2"><span className="mb-1 block font-medium">Cover image URL (optional)</span>
          <input value={f.coverImageUrl} onChange={(e) => setF({ ...f, coverImageUrl: e.target.value })} className={inputCls} placeholder="Leave blank for a generated cover" />
        </label>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Shelves and genres</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TAG_LABELS).map(([t, label]) => (
            <label key={t} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${f.tags.has(t) ? 'border-green-900 bg-green-900 text-white' : 'border-stone-300 bg-white'}`}>
              <input type="checkbox" className="sr-only" checked={f.tags.has(t)} onChange={() => toggleTag(t)} />{label}
            </label>
          ))}
        </div>
      </fieldset>

      {formats.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{mode === 'create' ? 'Formats' : 'Add a format'}</legend>
          {formats.map((r, i) => (
            <div key={r.format} className="flex flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <label className="flex w-32 items-center gap-2 pb-2 text-sm font-medium capitalize">
                <input type="checkbox" checked={r.enabled} onChange={(e) => setFormat(i, { enabled: e.target.checked })} /> {r.format}
              </label>
              {r.enabled && (
                <>
                  <label className="text-sm"><span className="mb-1 block">Price ($)</span><input type="number" step="0.01" min="0.01" value={r.price} onChange={(e) => setFormat(i, { price: e.target.value })} className={`${inputCls} w-28`} /></label>
                  <label className="text-sm"><span className="mb-1 block">Sale price ($)</span><input type="number" step="0.01" min="0.01" value={r.sale} onChange={(e) => setFormat(i, { sale: e.target.value })} className={`${inputCls} w-28`} placeholder="none" /></label>
                  <label className="text-sm"><span className="mb-1 block">Starting stock</span><input type="number" min="0" value={r.stock} onChange={(e) => setFormat(i, { stock: e.target.value })} className={`${inputCls} w-28`} /></label>
                  <label className="text-sm"><span className="mb-1 block">Alert at</span><input type="number" min="0" value={r.threshold} onChange={(e) => setFormat(i, { threshold: e.target.value })} className={`${inputCls} w-24`} /></label>
                </>
              )}
            </div>
          ))}
          {mode === 'edit' && <p className="text-xs text-stone-500">Change prices and stock of existing formats on the Inventory page.</p>}
        </fieldset>
      )}

      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : mode === 'create' ? 'Add book' : 'Save changes'}</button>
        <Link href="/admin/inventory" className={btnSecondary}>Back to inventory</Link>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-green-800' : 'text-red-700'}`}>{msg.text}</p>}
    </form>
  );
}
