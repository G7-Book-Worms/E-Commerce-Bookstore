import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getStaffSession } from '@/server/src/modules/staff/staff-page';
import { PageHeader, Panel } from '@/components/staff/ui';
import { StaffPasswordForm } from './password-form';

export const metadata = { title: 'Change password' };

async function Content() {
  const staff = await getStaffSession();
  if (!staff) redirect('/staff-login');
  return (
    <>
      <PageHeader
        title={staff.mustChangePassword ? 'Choose a new password' : 'Change password'}
        description={staff.mustChangePassword ? 'An administrator gave you a temporary password. Choose your own before using the portal.' : 'Changing it signs you out on every other device.'}
      />
      <Panel className="max-w-md">
        <StaffPasswordForm email={staff.email} temporary={staff.mustChangePassword} />
      </Panel>
    </>
  );
}

export default function Page() {
  return <Suspense><Content /></Suspense>;
}
