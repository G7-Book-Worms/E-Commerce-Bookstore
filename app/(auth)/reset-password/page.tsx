import { Suspense } from 'react';
import { ResetPasswordForm } from './reset-form';

export const metadata = { title: 'Choose a new password | Book Worms', robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-neutral-100" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
