import { Suspense } from 'react';
import { requireStaffPage } from '@/server/src/modules/staff/staff-page';
import { actionableStaffIds, listStaff, nextEmployeeId } from '@/server/src/modules/staff/staff-accounts';
import { assignableRoles } from '@/lib/staff-permissions';
import { PageHeader, Panel } from '@/components/staff/ui';
import { StaffManager } from './staff-manager';

export const metadata = { title: 'Staff' };

async function Content() {
  const me = await requireStaffPage('staff.manage');
  const [rows, nextId] = await Promise.all([listStaff(), nextEmployeeId()]);
  const plain = rows.map((r) => ({ ...r, lastLogin: r.lastLogin ? r.lastLogin.toISOString() : null, created: r.created.toISOString() }));
  // Worked out here, from the roles in the database, rather than in the browser: which rows this
  // staff member may act on at all, and which roles they may hand out. The API checks both again
  // on every request, so this is only what the page is allowed to offer.
  const actionable = actionableStaffIds({ id: me.id, role: me.role }, rows.map((r) => ({ adminId: r.adminId, role: r.role })));
  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Employees handle orders, stock counts, messages and customer enquiries. Managers also set prices and sales, add books, and run discounts, customers and the activity log. Administrators also manage staff. Management only runs downward: you cannot change your own account, an account at your own level, or the owner's."
      />
      <Panel>
        <StaffManager
          rows={plain}
          meId={me.id}
          actionableIds={actionable}
          assignable={assignableRoles(me.role)}
          nextEmployeeId={nextId}
        />
      </Panel>
    </>
  );
}

export default function StaffPage() {
  return <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}><Content /></Suspense>;
}
