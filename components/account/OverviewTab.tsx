// components/account/OverviewTab.tsx
'use client';

import React from 'react';
import { UserProfile, UserOrder } from '@/lib/api/user';

interface Props {
  profile: UserProfile;
  orders: UserOrder[];
  onSelectTab: (tab: string) => void;
}

export const OverviewTab: React.FC<Props> = ({ profile, orders, onSelectTab }) => {
  const activeOrdersCount = orders.filter((o) => o.status === 'pending' || o.status === 'transit').length;

  return (
    <div className="space-y-8">
      {/* Item 3: "Hello, username" Greeting Banner in shadcn palette */}
      <div className="rounded-xl border border-stone-800 bg-stone-900 text-stone-50 p-8 shadow-sm">
        <div className="inline-flex items-center rounded-full border border-stone-700 bg-stone-800 px-3 py-1 text-xs font-semibold text-stone-300 mb-3">
          Member Dashboard
        </div>
        <h2 className="text-3xl font-serif font-bold tracking-tight text-white">
          Hello, {profile.firstName || profile.name}!
        </h2>
        <p className="text-stone-400 mt-2 text-sm leading-relaxed">
          Registered reader since {new Date(profile.created).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* Item 4: Scaled-up Metric Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 p-6 rounded-xl shadow-xs flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Active Orders</p>
            <p className="text-4xl font-bold text-stone-900 mt-3">{activeOrdersCount}</p>
          </div>
          <button
            onClick={() => onSelectTab('orders')}
            className="text-sm font-medium text-stone-900 hover:text-stone-600 mt-5 inline-flex items-center gap-1 transition-colors"
          >
            Track shipments &rarr;
          </button>
        </div>

        <div className="bg-white border border-stone-200 p-6 rounded-xl shadow-xs flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Registered Email</p>
            <p className="text-base font-semibold text-stone-900 mt-3 truncate">{profile.email}</p>
          </div>
          <button
            onClick={() => onSelectTab('profile')}
            className="text-sm font-medium text-stone-900 hover:text-stone-600 mt-5 inline-flex items-center gap-1 transition-colors"
          >
            Edit profile &rarr;
          </button>
        </div>

        <div className="bg-white border border-stone-200 p-6 rounded-xl shadow-xs flex flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Primary Contact</p>
            <p className="text-base font-semibold text-stone-900 mt-3">{profile.phone || 'None provided'}</p>
          </div>
          <button
            onClick={() => onSelectTab('addresses')}
            className="text-sm font-medium text-stone-900 hover:text-stone-600 mt-5 inline-flex items-center gap-1 transition-colors"
          >
            Manage addresses &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};