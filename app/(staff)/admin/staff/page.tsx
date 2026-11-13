import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { listStaff, nextEmployeeId } from '@/server/src/modules/staff/staff-accounts';
import { PageHeader, Panel } from '@/components/staff/ui';
import { StaffManager } from './staff-manager';

export const metadata = { title: 'Staff' };

async function Content() {
  const me = await requireStaffPage('staff.manage');
  const [rows, nextId] = await Promise.all([listStaff(), nextEmployeeId()]);
  const plain = rows.map((r) => ({ ...r, lastLogin: r.lastLogin ? r.lastLogin.toISOString() : null, created: r.created.toISOString() }));
  return (
    <>
      <PageHeader title="Staff accounts" description="Employees handle orders, stock counts and messages. Managers also set prices and sales, add books, and run discounts, customers and the activity log. Administrators also manage staff." />
      <Panel><StaffManager rows={plain} meId={me.id} nextEmployeeId={nextId} /></Panel>
    </>
  );
}

export default function StaffPage() {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content /></Suspense>;
}
