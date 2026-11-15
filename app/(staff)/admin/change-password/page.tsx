import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getStaffSession } from '@/server/src/modules/staff/staff-page';
import { PageHeader, Panel } from '@/components/staff/ui';
import { StaffPasswordForm } from './password-form';
import { TwoStepSettings } from '@/components/auth/two-step-settings';

export const metadata = { title: 'Password & sign-in' };

async function Content() {
  const staff = await getStaffSession();
  if (!staff) redirect('/staff-login');
  return (
    <>
      <PageHeader
        title={staff.mustChangePassword ? 'Choose a new password' : 'Password & sign-in'}
        description={staff.mustChangePassword ? 'An administrator gave you a temporary password. Choose your own before using the portal.' : 'Changing it signs you out on every other device.'}
      />
      <Panel className="max-w-md">
        <StaffPasswordForm email={staff.email} temporary={staff.mustChangePassword} />
      </Panel>
      {!staff.mustChangePassword && (
        <section aria-labelledby="two-step-heading" className="mt-6 max-w-md">
          <h2 id="two-step-heading" className="mb-2 font-serif text-lg font-bold">Two-step sign-in</h2>
          <Panel>
            <TwoStepSettings endpoint="/api/staff/mfa" staff />
          </Panel>
        </section>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><Content /></Suspense>;
}
