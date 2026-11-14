// components/account/AddressesTab.tsx
'use client';

import React, { useState } from 'react';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import {
  AddressItem,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress,
} from '@/lib/api/user';

interface Props {
  addresses: AddressItem[];
  onRefresh: () => void;
}

export const AddressesTab: React.FC<Props> = ({ addresses, onRefresh }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressItem | null>(null);

  const [formData, setFormData] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    isDefault: false,
  });

  const openCreateModal = () => {
    setEditingAddress(null);
    setFormData({
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'United States',
      isDefault: addresses.length === 0,
    });
    setModalOpen(true);
  };

  const openEditModal = (addr: AddressItem) => {
    setEditingAddress(addr);
    setFormData({
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAddress) {
        await updateUserAddress(editingAddress.addressId, formData);
      } else {
        await createUserAddress(formData);
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save address');
    }
  };

  const handleSetDefault = async (addrId: number) => {
    try {
      await updateUserAddress(addrId, { isDefault: true });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to set default address');
    }
  };

  const handleDelete = async (addrId: number) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      await deleteUserAddress(addrId);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete address');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-stone-200 pb-5">
        <div>
          <h3 className="text-xl font-bold text-stone-900 tracking-tight">Saved Addresses</h3>
          <p className="text-sm text-stone-500 mt-0.5">Manage your shipping and billing destinations.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="h-10 px-4 rounded-md bg-stone-900 text-stone-50 text-xs font-semibold hover:bg-stone-800 transition-colors shadow-xs"
        >
          + Add New Address
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {addresses.map((addr) => (
          <div
            key={addr.addressId}
            className={`p-6 rounded-xl border bg-white shadow-xs flex flex-col justify-between transition-all ${
              addr.isDefault ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-mono uppercase tracking-wider text-stone-500">Shipping Destination</span>
                {addr.isDefault && (
                  <span className="bg-stone-900 text-stone-50 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                    Default
                  </span>
                )}
              </div>
              <p className="text-base font-semibold text-stone-900">{addr.street}</p>
              <p className="text-sm text-stone-600 mt-1">
                {addr.city}, {addr.state} {addr.zip}
              </p>
              <p className="text-sm text-stone-600">{addr.country}</p>
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs">
              <div className="space-x-3">
                <button
                  onClick={() => openEditModal(addr)}
                  className="text-stone-700 hover:text-stone-900 font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(addr.addressId)}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  Delete
                </button>
              </div>

              {!addr.isDefault && (
                <button
                  onClick={() => handleSetDefault(addr.addressId)}
                  className="text-stone-900 hover:underline font-semibold"
                >
                  Set as Default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8 space-y-6 border border-stone-200">
            <div>
              <h4 className="text-lg font-bold text-stone-900">
                {editingAddress ? 'Edit Address' : 'Add New Shipping Address'}
              </h4>
              <p className="text-xs text-stone-500 mt-1">All fields are used directly on packaging labels.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <AddressAutocomplete
                label="Street Address"
                required
                value={formData.street}
                onChange={(street) => setFormData((f) => ({ ...f, street }))}
                // Keeps any other form state (such as the default-address flag) as it was.
                onSelect={(a) => setFormData((f) => ({ ...f, street: a.street, city: a.city, state: a.state, zip: a.zip, country: a.country }))}
                className="space-y-1.5"
                labelClassName="block text-xs font-semibold text-stone-700 uppercase"
                inputClassName="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-700 uppercase">City</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-700 uppercase">State / Province</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-700 uppercase">Postal Code</label>
                  <input
                    type="text"
                    required
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                    className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-stone-700 uppercase">Country</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
                <span className="text-xs text-stone-700 font-medium">Make this my primary delivery address</span>
              </label>

              <div className="flex justify-end gap-3 pt-5 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 px-4 border border-stone-200 rounded-md text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 bg-stone-900 text-stone-50 rounded-md hover:bg-stone-800 text-xs font-semibold transition-colors"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};