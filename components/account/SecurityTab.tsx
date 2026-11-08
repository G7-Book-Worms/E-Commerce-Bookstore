// components/account/SecurityTab.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeUserPassword } from '@/lib/api/user';

export const SecurityTab: React.FC = () => {
  const router = useRouter();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setStatusMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    try {
      setIsUpdating(true);
      await changeUserPassword(passwordForm);
      setStatusMsg({ type: 'success', text: 'Password updated successfully.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      router.push('/');
      router.refresh();
    } catch {
      router.push('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-8 max-w-xl">
      {/* Password Management */}
      <div className="bg-white border border-stone-200 rounded-xl p-8 shadow-xs">
        <div className="border-b border-stone-100 pb-5 mb-6">
          <h3 className="text-xl font-bold text-stone-900 tracking-tight">Account Credentials</h3>
          <p className="text-sm text-stone-500 mt-1">Ensure your account is using a strong, unique password.</p>
        </div>

        {statusMsg && (
          <div
            className={`mb-6 p-4 rounded-lg text-sm flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-stone-50 text-stone-900 border border-stone-200'
                : 'bg-stone-50 text-red-700 border border-red-200'
            }`}
          >
            <span className="font-bold">{statusMsg.type === 'success' ? '✓' : '✕'}</span>
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">Current Password</label>
            <input
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">New Password</label>
            <input
              type="password"
              required
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700">Confirm New Password</label>
            <input
              type="password"
              required
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdating}
            className="mt-2 h-10 px-5 rounded-md bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Sign Out Card */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs flex items-center justify-between">
        <button
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="h-10 px-5 border border-stone-300 text-stone-900 hover:bg-stone-100 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? 'Signing out...' : 'Sign Out of Account'}
        </button>
      </div>
    </div>
  );
};