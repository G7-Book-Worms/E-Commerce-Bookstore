import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listActivity } from '@/server/src/modules/activity/activity-query';
import { Badge, EmptyState, PageHeader, Pager, Table, dateTime, inputCls, td, th } from '@/components/staff/ui';
import { FilterBar } from '@/components/staff/filter-bar';

export const metadata = { title: 'Activity log' };
type SP = Record<string, string | undefined>;
const ACTOR = { customer: 'blue', admin: 'purple', system: 'gray' } as const;

function details(d: unknown) {
  if (!d || typeof d !== 'object') return '';
  return Object.entries(d as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

async function Content({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaffPage('activity.view');
  const sp = await searchParams;
  const result = await listActivity({ actor: sp.actor, q: sp.q, page: Number(sp.page) || 1 });
  const params = { actor: sp.actor, q: sp.q };
  return (
    <>
      <PageHeader title="Activity log" description="Every sign-in, order, stock change and staff action, newest first. Entries can't be edited or deleted from the portal." />
      <FilterBar action="/admin/activity" q={sp.q} placeholder="Action, email, IP or detail (e.g. order.placed)">
        <label className="sr-only" htmlFor="actor">Who</label>
        <select id="actor" name="actor" defaultValue={sp.actor ?? ''} className={`${inputCls} sm:w-40`}>
          <option value="">Everyone</option><option value="customer">Customers</option><option value="admin">Staff</option><option value="system">System</option>
        </select>
      </FilterBar>
      {result.rows.length === 0 ? <EmptyState title="Nothing logged yet" /> : (
        <Table>
          <thead><tr><th className={th}>When</th><th className={th}>Who</th><th className={th}>Action</th><th className={th}>Details</th><th className={th}>IP</th></tr></thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.activityId}>
                <td className={`${td} whitespace-nowrap text-stone-600`}>{dateTime(r.created)}</td>
                <td className={td}>
                  <Badge color={ACTOR[r.actorType]}>{r.actorType === 'admin' ? 'staff' : r.actorType}</Badge>
                  {r.actorName && <div className="mt-1 text-xs">{r.actorName}</div>}
                  {r.actorEmail && <div className="text-xs text-stone-500">{r.actorEmail}</div>}
                </td>
                <td className={`${td} font-mono text-xs`}>{r.action}</td>
                <td className={`${td} max-w-md break-words text-xs text-stone-600`}>{details(r.details)}</td>
                <td className={`${td} font-mono text-xs text-stone-500`}>{r.ip ?? ''}</td>
              </tr>
            ))}
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
