'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { logoutUser } from '@/lib/api/auth';

interface UserProfile {
  userId?: number;
  id?: number;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  phone?: string;
  role?: string;
  joinedDate?: string;
}

interface OrderItem {
  orderId: number;
  date?: string;
  status: string;
  totalItems?: number;
  priceCents: number;
  trackingNumber?: string;
}

type TabType = 'overview' | 'orders' | 'addresses' | 'settings';

export default function UserDashboardPage() {
  const router = useRouter();
  const { user, isLoading, setUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/user-login');
      return;
    }

    async function loadDashboardData() {
      setIsDataLoading(true);
      setErrorMessage(null);

      try {
        // Fetch Profile
        const profileRes = await fetch('/api/users/profile', {
          credentials: 'include',
        });

        if (!profileRes.ok) {
          if (profileRes.status === 401) {
            setUser(null);
            router.push('/user-login');
            return;
          }
          throw new Error('Failed to load user profile');
        }

        const profileData = await profileRes.json();
        const extractedProfile = profileData?.data?.user || profileData?.data || profileData;
        setProfile(extractedProfile);

        // Fetch Orders
        const ordersRes = await fetch('/api/users/orders?page=1&limit=10', {
          credentials: 'include',
        });

        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData?.data?.orders || ordersData?.orders || []);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Unable to load customer dashboard');
      } finally {
        setIsDataLoading(false);
      }
    }

    loadDashboardData();
  }, [user, isLoading, router, setUser]);

  const handleSignOut = async () => {
    try {
      await logoutUser();
      setUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  if (isLoading || (isDataLoading && !profile)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="space-y-6 animate-pulse">
          <div className="h-24 bg-stone-200 rounded-xl" />
          <div className="h-80 bg-stone-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const displayName = profile?.name || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || user?.name || 'Reader';
  const displayEmail = profile?.email || user?.email || '';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Profile Bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-2xl font-serif font-bold shadow-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-stone-900">{displayName}</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-medium uppercase tracking-wider">
                {user?.role || 'Customer'}
              </span>
            </div>
            <p className="text-sm text-stone-500 mt-0.5">{displayEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link
            href="/product-catalog"
            className="flex-1 md:flex-none text-center px-4 py-2 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 hover:bg-stone-50 transition"
          >
            Browse Books
          </Link>
          <button
            onClick={handleSignOut}
            className="flex-1 md:flex-none px-4 py-2 border border-red-200 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Main Content Area with Navigation Tabs */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-stone-200 px-6 flex space-x-8 overflow-x-auto">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'orders', label: 'Orders & Tracking' },
              { id: 'addresses', label: 'Addresses' },
              { id: 'settings', label: 'Account Settings' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="p-6 sm:p-8">
            <section>
              <h2 className="text-lg font-serif font-bold text-stone-900 mb-4">Account Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-stone-50 border border-stone-200/60 rounded-xl p-5 text-xs">
                <div>
                  <span className="font-semibold text-stone-400 uppercase tracking-wider">First Name</span>
                  <p className="text-stone-900 font-medium text-sm mt-0.5">{profile?.firstName || '—'}</p>
                </div>
                <div>
                  <span className="font-semibold text-stone-400 uppercase tracking-wider">Last Name</span>
                  <p className="text-stone-900 font-medium text-sm mt-0.5">{profile?.lastName || '—'}</p>
                </div>
                <div>
                  <span className="font-semibold text-stone-400 uppercase tracking-wider">Contact Phone</span>
                  <p className="text-stone-900 font-medium text-sm mt-0.5">{profile?.phone || 'Not provided'}</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <div className="p-6 sm:p-8">
            <h2 className="text-lg font-serif font-bold text-stone-900 mb-4">All Order History</h2>
            {orders.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-stone-200 rounded-xl">
                <p className="text-sm text-stone-500">You haven&apos;t placed any orders yet.</p>
                <Link
                  href="/product-catalog"
                  className="mt-3 inline-block px-4 py-2 bg-stone-900 text-stone-50 rounded-lg text-xs font-semibold hover:bg-stone-800 transition"
                >
                  Explore Bookstore
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.orderId}
                    className="border border-stone-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:border-stone-300 transition"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-stone-900 text-sm">Order #{order.orderId}</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {order.status || 'Complete'}
                        </span>
                      </div>
                      {order.trackingNumber && (
                        <p className="text-xs text-stone-500 mt-1">
                          Tracking: <span className="font-mono">{order.trackingNumber}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-stone-100">
                      <span className="text-base font-serif font-bold text-stone-900">
                        ${(order.priceCents / 100).toFixed(2)}
                      </span>
                      <button className="px-3 py-1.5 border border-stone-200 rounded-md text-xs font-medium hover:bg-stone-50 transition">
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Addresses */}
        {activeTab === 'addresses' && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-serif font-bold text-stone-900">Shipping Addresses</h2>
              <button className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-semibold hover:bg-stone-50">
                + Add New Address
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-stone-200 rounded-xl p-5 relative">
                <span className="absolute top-4 right-4 text-[10px] font-semibold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full uppercase">
                  Default
                </span>
                <p className="font-semibold text-sm text-stone-900">{displayName}</p>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  100 Lovelace Lane<br />
                  London, UK SW1A 1AA<br />
                  Phone: {profile?.phone || '555-0100'}
                </p>
                <div className="flex gap-3 mt-4 pt-4 border-t border-stone-100 text-xs">
                  <button className="text-stone-700 hover:underline">Edit</button>
                  <button className="text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Settings */}
        {activeTab === 'settings' && (
          <div className="p-6 sm:p-8 max-w-2xl">
            <h2 className="text-lg font-serif font-bold text-stone-900 mb-6">Account Settings</h2>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase font-semibold text-stone-400 mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={displayEmail}
                  className="w-full h-10 px-3 bg-stone-100 border border-stone-200 rounded-md text-stone-600 cursor-not-allowed"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase font-semibold text-stone-400 mb-1">First Name</label>
                  <input
                    type="text"
                    defaultValue={profile?.firstName || ''}
                    className="w-full h-10 px-3 border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block uppercase font-semibold text-stone-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    defaultValue={profile?.lastName || ''}
                    className="w-full h-10 px-3 border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>
              <div>
                <label className="block uppercase font-semibold text-stone-400 mb-1">Phone Number</label>
                <input
                  type="text"
                  defaultValue={profile?.phone || ''}
                  className="w-full h-10 px-3 border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
              <div className="pt-4">
                <button
                  type="button"
                  className="px-5 py-2.5 bg-stone-900 text-stone-50 rounded-lg font-semibold hover:bg-stone-800 transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}