'use client';

// "Delete this address?" confirmation, shared by checkout's saved-address list and the account
// Addresses tab. Shows the full address so the shopper can see exactly which one goes, then calls
// DELETE /api/users/addresses/[id] (deleteUserAddress). Open it by passing an address; it reports
// back through onDeleted (with the id) or onCancel.

import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { deleteUserAddress, type AddressItem } from '@/lib/api/user';

interface Props {
  address: AddressItem | null;
  onCancel: () => void;
  onDeleted: (addressId: number) => void;
}

export function DeleteAddressDialog({ address, onCancel, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onCancel();
  };

  const confirm = async () => {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await deleteUserAddress(address.addressId);
      onDeleted(address.addressId);
    } catch (err) {
      setError((err as Error).message || 'Could not delete this address. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={!!address}
      title="Delete this address?"
      confirmLabel="Delete"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={close}
    >
      {address && (
        <address className="rounded-lg border border-stone-200 bg-stone-50 p-3 not-italic leading-relaxed">
          {address.street}
          <br />
          {address.city}, {address.state} {address.zip}
          <br />
          {address.country}
          {address.isDefault && <span className="mt-1 block text-xs font-medium text-stone-500">Your default address</span>}
        </address>
      )}
    </ConfirmDialog>
  );
}
