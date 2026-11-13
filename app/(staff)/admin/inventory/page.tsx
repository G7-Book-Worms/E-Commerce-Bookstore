import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { can } from '@/lib/staff-permissions';
import { inventoryCounts, listInventory, recentMovements, type InventoryFilter, type InventorySort } from '@/server/src/modules/inventory/inventory-service';
import { btnPrimary, EmptyState, PageHeader, Panel, SortLink, StatCard, Table, dateTime, td, th } from '@/components/staff/ui';
import { FilterBar } from '@/components/staff/filter-bar';
import { InventoryRow } from './inventory-row';

export const metadata = { title: 'Inventory' };
type SP = Record<string, string | undefined>;

const FILTERS: { value: InventoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Sold out' },
  { value: 'sale', label: 'On sale' },
];

const REASON: Record<string, string> = { sale: 'Sold', restock: 'Restocked', adjustment: 'Corrected', cancellation: 'Returned (cancelled order)' };

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaffPage('inventory.view');
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.value === sp.filter) ? sp.filter : 'all') as InventoryFilter;
  const sort = (['title', 'stock', 'price'].includes(sp.sort ?? '') ? sp.sort : 'title') as InventorySort;
  const dir = sp.dir === 'desc' ? 'desc' : sp.sort ? 'asc' : 'asc';
  const [rows, counts, movements] = await Promise.all([
    listInventory({ q: sp.q, filter, sort, dir: sp.dir === 'desc' ? 'desc' : 'asc' }),
    inventoryCounts(),
    recentMovements(undefined, 15),
  ]);
  const editable = can(staff.role, 'inventory.update');
  const params = { q: sp.q, filter: sp.filter, sort: sp.sort, dir };

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock per edition. Every change is recorded below; low stock emails support@bookwrms.store."
        actions={editable ? <Link href="/admin/books/new" className={btnPrimary}>Add a book</Link> : undefined}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Copies in stock" value={counts.copies} hint={`${counts.formats} editions`} />
        <StatCard label="Low stock" value={counts.low} href="/admin/inventory?filter=low" tone={counts.low ? 'warn' : 'default'} />
        <StatCard label="Sold out" value={counts.out} href="/admin/inventory?filter=out" tone={counts.out ? 'bad' : 'default'} />
        <StatCard label="On sale" value={counts.onSale} href="/admin/inventory?filter=sale" />
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/inventory?filter=${f.value}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`}
            aria-current={filter === f.value ? 'true' : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f.value ? 'border-green-900 bg-green-900 text-white' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <FilterBar action="/admin/inventory" q={sp.q} placeholder="Title, author or ISBN" hidden={{ filter: sp.filter, sort: sp.sort, dir: sp.dir }} />

      {rows.length === 0 ? (
        <EmptyState title="Nothing here" text={filter === 'low' ? 'No editions are running low. Nice!' : 'No editions match.'} image="/images/empty-states/black-puppy-staring.webp" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}><SortLink label="Book" column="title" params={params} basePath="/admin/inventory" /></th>
              <th className={th}><SortLink label="Price" column="price" params={params} basePath="/admin/inventory" /></th>
              <th className={th}><SortLink label="Stock" column="stock" params={params} basePath="/admin/inventory" /></th>
              <th className={th}>Alert at</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <InventoryRow key={r.bookFormatId} row={r} editable={editable} />)}
          </tbody>
        </Table>
      )}

      <Panel title="Recent stock changes" className="mt-6">
        {movements.length === 0 ? <p className="text-sm text-stone-500">No stock changes yet.</p> : (
          <ul className="divide-y divide-stone-100 text-sm">
            {movements.map((m) => (
              <li key={m.movementId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-40 shrink-0 text-stone-500">{dateTime(m.created)}</span>
                <span className={`w-12 shrink-0 font-semibold ${m.quantityChange > 0 ? 'text-green-800' : 'text-red-700'}`}>{m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}</span>
                <span className="min-w-0 flex-1 truncate">{m.title} <span className="text-stone-400">({m.format})</span></span>
                <span className="text-stone-600">{REASON[m.reason]}{m.orderId ? ` · order #${m.orderId}` : ''}{m.staffName ? ` · ${m.staffName}` : ''}</span>
                <span className="text-stone-500">→ {m.stockAfter}</span>
                {m.note && <span className="basis-full pl-[11.75rem] text-xs text-stone-500">“{m.note}”</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default function InventoryPage(props: { searchParams: Promise<SP> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading inventory…</p>}><Content {...props} /></Suspense>;
}
