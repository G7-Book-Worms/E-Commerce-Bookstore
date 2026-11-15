import Link from 'next/link';
import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listActivity } from '@/server/src/modules/activity/activity-query';
import { Badge, EmptyState, PageHeader, Pager, Table, dateTime, inputCls, td, th } from '@/components/staff/ui';
import { FilterBar } from '@/components/staff/filter-bar';
import { ActionText, CategoryBadge, FailureBadge } from '@/components/staff/activity-ui';
import { ACTIVITY_CATEGORIES, CATEGORY_INFO, describeAction, type ActivityCategory } from '@/lib/activity-categories';
import { activityFilterParams, parseActivityFilters, type ActivityFilters } from '@/lib/activity-filters';
import { describeDetails } from '@/lib/activity-details';

export const metadata = { title: 'Activity log' };
type SP = Record<string, string | string[] | undefined>;
const ACTOR = { customer: 'blue', admin: 'purple', system: 'gray' } as const;
const DOT: Record<string, string> = {
  red: 'bg-red-500', green: 'bg-green-600', amber: 'bg-amber-500', blue: 'bg-sky-500',
  indigo: 'bg-indigo-500', pink: 'bg-pink-500', teal: 'bg-teal-500', gray: 'bg-stone-400',
};

function hrefWith(filters: ActivityFilters, change: Partial<Record<string, string | undefined>>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...activityFilterParams(filters), ...change })) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/activity?${s}` : '/admin/activity';
}

function CategoryChips({ filters, counts, allCount }: { filters: ActivityFilters; counts: Record<ActivityCategory, number>; allCount: number }) {
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 ${
      active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
    }`;
  const count = (n: number, active: boolean) => (
    <span className={`text-xs tabular-nums ${active ? 'text-stone-300' : 'text-stone-400'}`}>{n.toLocaleString('en-US')}</span>
  );
  return (
    <nav aria-label="Filter by category" className="mb-4">
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href={hrefWith(filters, { category: undefined })} className={chip(!filters.category)} aria-current={!filters.category ? 'page' : undefined}>
            All {count(allCount, !filters.category)}
          </Link>
        </li>
        {ACTIVITY_CATEGORIES.map((c) => {
          const active = filters.category === c;
          const info = CATEGORY_INFO[c];
          return (
            <li key={c}>
              <Link href={hrefWith(filters, { category: c })} className={chip(active)} aria-current={active ? 'page' : undefined} title={info.description}>
                <span aria-hidden="true" className={`size-2 rounded-full ${DOT[info.color]}`} />
                {info.label} {count(counts[c], active)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Details({ details, action }: { details: unknown; action: string }) {
  const items = describeDetails(details, action);
  if (items.length === 0) return <span className="text-stone-400">—</span>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {items.map((item) => (
        <div key={item.key} className="contents">
          <dt className="text-stone-500">{item.label}</dt>
          <dd className="min-w-0 break-words text-stone-800">
            {item.parts.length > 1 && item.key === 'items' ? (
              <ul className="list-disc pl-4">
                {item.parts.map((p, i) => (
                  <li key={i}>{p.href ? <Link href={p.href} className="underline underline-offset-2 hover:text-stone-950">{p.text}</Link> : p.text}</li>
                ))}
              </ul>
            ) : (
              item.parts.map((p, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  {p.href ? <Link href={p.href} className="underline underline-offset-2 hover:text-stone-950">{p.text}</Link> : p.text}
                </span>
              ))
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaffPage('activity.view');
  // Every parameter goes through a whitelist before it reaches the query.
  const filters = parseActivityFilters(await searchParams);
  const result = await listActivity(filters);
  const params = activityFilterParams(filters);
  const filtered = !!(filters.category || filters.actor || filters.q || filters.from || filters.to);
  const heading = filters.category ? CATEGORY_INFO[filters.category].label : 'All activity';

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every sign-in, order, stock change and staff action. Entries are a permanent record: they can't be edited or deleted from the portal."
      />
      <CategoryChips filters={filters} counts={result.counts} allCount={result.allCount} />
      <FilterBar action="/admin/activity" q={filters.q} placeholder="Search email, IP, order number or action" hidden={{ category: filters.category }}>
        <label className="sr-only" htmlFor="actor">Who did it</label>
        <select id="actor" name="actor" defaultValue={filters.actor ?? ''} className={`${inputCls} sm:w-36`}>
          <option value="">Anyone</option><option value="customer">Customers</option><option value="admin">Staff</option><option value="system">System</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-stone-600" htmlFor="from">
          From
          <input id="from" name="from" type="date" defaultValue={filters.from} className={`${inputCls} sm:w-40`} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-stone-600" htmlFor="to">
          To
          <input id="to" name="to" type="date" defaultValue={filters.to} className={`${inputCls} sm:w-40`} />
        </label>
        <label className="sr-only" htmlFor="sort">Order</label>
        <select id="sort" name="sort" defaultValue={filters.sort} className={`${inputCls} sm:w-36`}>
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </select>
      </FilterBar>
      {filtered && (
        <p className="mb-3 text-sm text-stone-500">
          <Link href="/admin/activity" className="underline underline-offset-2 hover:text-stone-900">Clear all filters</Link>
        </p>
      )}

      {result.rows.length === 0 ? (
        <EmptyState title={filtered ? 'No entries match these filters' : 'Nothing logged yet'} text={filtered ? 'Try another category, a wider date range or a shorter search.' : undefined} />
      ) : (
        <Table>
          <caption className="sr-only">
            {heading}, {filters.sort === 'oldest' ? 'oldest' : 'newest'} first. Rows marked &quot;Failed / blocked&quot; are failed sign-ins, lockouts or wrong passwords.
          </caption>
          <thead>
            <tr>
              <th scope="col" className={th}>When</th>
              <th scope="col" className={th}>Who</th>
              <th scope="col" className={th}>What happened</th>
              <th scope="col" className={th}>Details</th>
              <th scope="col" className={th}>IP address</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => {
              const d = describeAction(r.action);
              return (
                <tr key={r.activityId} className={d.failure ? 'bg-red-50' : undefined}>
                  <td className={`${td} whitespace-nowrap text-stone-600 ${d.failure ? 'border-l-4 border-l-red-500' : ''}`}>{dateTime(r.created)}</td>
                  <td className={td}>
                    <Badge color={ACTOR[r.actorType]}>{r.actorType === 'admin' ? 'staff' : r.actorType}</Badge>
                    {r.actorName && (
                      <div className="mt-1 text-xs">
                        {r.actorType === 'customer' && r.actorId
                          ? <Link href={`/admin/customers/${r.actorId}`} className="underline underline-offset-2 hover:text-stone-950">{r.actorName}</Link>
                          : r.actorName}
                      </div>
                    )}
                    {r.actorEmail && <div className="text-xs break-all text-stone-500">{r.actorEmail}</div>}
                  </td>
                  <td className={`${td} min-w-56`}>
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <CategoryBadge d={d} />
                      {d.failure && <FailureBadge />}
                    </div>
                    <ActionText d={d} action={r.action} />
                  </td>
                  <td className={`${td} max-w-md text-xs`}><Details details={r.details} action={r.action} /></td>
                  <td className={`${td} font-mono text-xs text-stone-500`}>{r.ip ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pager page={result.page} total={result.total} pageSize={result.pageSize} params={params} basePath="/admin/activity" />
    </>
  );
}

export default function ActivityPage(props: { searchParams: Promise<SP> }) {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content {...props} /></Suspense>;
}
