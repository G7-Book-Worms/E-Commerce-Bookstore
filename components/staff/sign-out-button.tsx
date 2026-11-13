'use client';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch('/api/staff/logout', { method: 'POST' });
        window.location.href = '/staff-login';
      }}
      className="text-xs text-green-100 underline underline-offset-2 hover:text-white"
    >
      Sign out
    </button>
  );
}
