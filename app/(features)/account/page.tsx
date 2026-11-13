'use client';

// My Account (SCRUM-201): overview, order history with full details, profile, addresses, password.
// Uses the tab components in components/account (built by the team) with live data from /api/users/*.

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { logoutUser } from '@/lib/api/auth';
import {
  fetchUserAddresses,
  fetchUserOrders,
  fetchUserProfile,
  type AddressItem,
  type UserOrder,
  type UserProfile,
} from '@/lib/api/user';
import { OverviewTab } from '@/components/account/OverviewTab';
import { OrdersTab } from '@/components/account/OrdersTab';
import { ProfileFormTab } from '@/components/account/ProfileFormTab';
import { AddressesTab } from '@/components/account/AddressesTab';
import { SecurityTab } from '@/components/account/SecurityTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'profile', label: 'Profile' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'security', label: 'Password' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Account />
    </Suspense>
  );
}

function Skeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-pulse">
      <div className="h-24 bg-stone-200 rounded-xl" />
      <div className="h-80 bg-stone-200 rounded-xl" />
    </div>
  );
}

function Account() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, setUser } = useAuth();

  // ?tab=orders opens a tab directly (used by the order confirmation page)
  const initial = TABS.some((t) => t.id === searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initial);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(() => {
    fetchUserAddresses().then(setAddresses).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/user-login?callbackUrl=/account');
      return;
    }
    fetchUserProfile()
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
    fetchUserOrders(1, 20)
      .then((r) => setOrders(r.orders))
      .catch((e: Error) => setError(e.message))
      .finally(() => setOrdersLoading(false));
    loadAddresses();
  }, [user, isLoading, router, loadAddresses]);

  function selectTab(tab: string) {
    if (!TABS.some((t) => t.id === tab)) return;
    setActiveTab(tab as TabId);
    router.replace(`/account?tab=${tab}`, { scroll: false });
  }

  async function handleSignOut() {
    try {
      await logoutUser();
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  }

  if (isLoading || !profile) {
    return error ? <p className="p-16 text-center text-red-700">{error}</p> : <Skeleton />;
  }

  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || 'Reader';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Profile bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-xl font-serif font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-stone-900">{displayName}</h1>
            <p className="text-sm text-stone-500">{profile.email}</p>
          </div>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Link href="/product-catalog" className="flex-1 sm:flex-none text-center px-4 py-2 border border-stone-200 rounded-lg text-sm font-medium hover:bg-stone-50">
            Browse Books
          </Link>
          <button onClick={handleSignOut} className="flex-1 sm:flex-none px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">
            Sign Out
          </button>
        </div>
      </div>

      {error && <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {/* Tabs */}
      <div role="tablist" aria-label="Account sections" className="flex gap-1 overflow-x-auto border-b border-stone-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => selectTab(t.id)}
            className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              activeTab === t.id ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            {t.label}
            {t.id === 'orders' && orders.length > 0 && <span className="ml-1.5 text-xs text-stone-400">{orders.length}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'overview' && <OverviewTab profile={profile} orders={orders} onSelectTab={selectTab} />}
        {activeTab === 'orders' && <OrdersTab orders={orders} isLoading={ordersLoading} />}
        {activeTab === 'profile' && <ProfileFormTab profile={profile} onProfileUpdated={setProfile} />}
        {activeTab === 'addresses' && <AddressesTab addresses={addresses} onRefresh={loadAddresses} />}
        {activeTab === 'security' && <SecurityTab />}
      </div>
    </div>
  );
}
