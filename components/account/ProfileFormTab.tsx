// components/account/ProfileFormTab.tsx
'use client';

import React, { useState } from 'react';
import { UserProfile, updateUserProfile } from '@/lib/api/user';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
}

export const ProfileFormTab: React.FC<Props> = ({ profile, onProfileUpdated }) => {
  const [formData, setFormData] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    email: profile.email || '',
    phone: profile.phone || '',
  });

  // Changing the email takes the current password: it's where sign-in codes and resets go
  const [currentPassword, setCurrentPassword] = useState('');
  const emailChanging = formData.email.trim().toLowerCase() !== (profile.email || '').toLowerCase();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMsg('First and last name are required.');
      return;
    }
    if (formData.phone && formData.phone.length < 7) {
      setErrorMsg('Please enter a valid phone number (at least 7 digits).');
      return;
    }

    try {
      setIsSubmitting(true);
      if (emailChanging && !currentPassword) {
        setErrorMsg('Enter your current password to change your email address.');
        return;
      }
      const updated = await updateUserProfile(emailChanging ? { ...formData, currentPassword } : formData);
      setCurrentPassword('');
      onProfileUpdated(updated);
      setSuccessMsg('Your personal details have been updated successfully.');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Failed to update personal details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-8 shadow-xs">
      <div className="border-b border-stone-100 pb-5 mb-6">
        <h3 className="text-xl font-bold text-stone-900 tracking-tight">Personal Information</h3>
        <p className="text-sm text-stone-500 mt-1">Update your display names, email address, and contact number.</p>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 rounded-lg bg-stone-50 border border-stone-200 text-stone-900 text-sm flex items-center gap-2">
          <span className="font-bold text-emerald-600">✓</span> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 rounded-lg bg-stone-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <span className="font-bold">✕</span> {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label htmlFor="profile-firstName" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">First Name</label>
            <input
              id="profile-firstName"
              autoComplete="given-name"
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="profile-lastName" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">Last Name</label>
            <input
              id="profile-lastName"
              autoComplete="family-name"
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="profile-email" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">Email Address</label>
          <input
            id="profile-email"
            autoComplete="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            required
          />
        </div>

        {emailChanging && (
          <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3">
            <label htmlFor="profile-current-password" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">Current password</label>
            <input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            />
            <p className="text-xs text-stone-600">Needed to change your email, since sign-in codes and password resets go there. We&apos;ll let your current address know.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="profile-phone" className="block text-xs font-semibold uppercase tracking-wider text-stone-700">Phone Number</label>
          <input
            id="profile-phone"
            autoComplete="tel"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="e.g. 555-0100"
            className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 h-10 px-5 rounded-md bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
        </button>
      </form>
    </div>
  );
};