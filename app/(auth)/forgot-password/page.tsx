import Link from 'next/link';

export const metadata = { title: 'Forgot password | Book Worms' };

// We don't reset passwords by email in this project: a staff member sets a temporary
// password from the admin portal after checking it's really you.
export default function ForgotPasswordPage() {
  return (
    <div className="space-y-4 text-left">
      <h2 className="text-2xl font-bold tracking-tight text-neutral-900 font-serif">Forgot your password?</h2>
      <p className="text-sm text-neutral-600">
        For your security, our staff reset passwords by hand. Send us a message from the
        <b> Contact Support</b> form at the bottom of any page, or email{' '}
        <a href="mailto:support@bookworms.com" className="font-medium text-neutral-900 underline">support@bookworms.com</a>{' '}
        from the address on your account.
      </p>
      <p className="text-sm text-neutral-600">
        We&apos;ll set a temporary password and you can change it under <b>My Account → Password</b>.
      </p>
      <Link href="/user-login" className="inline-block text-sm font-medium text-neutral-900 underline underline-offset-4">
        &larr; Back to sign in
      </Link>
    </div>
  );
}
