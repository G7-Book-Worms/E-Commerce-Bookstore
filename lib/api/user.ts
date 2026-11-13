// lib/api/user.ts

export interface UserProfile {
  userId: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  created: string;
  updated: string;
}

export interface AddressItem {
  addressId: number;
  userId: number;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

export interface OrderItemDetail {
  orderItemId: number;
  orderId: number;
  bookId: number;
  title?: string;
  author?: string;
  quantity: number;
  unitPrice: string;
}

export interface UserOrder {
  orderId: number;
  status: 'pending' | 'transit' | 'arrived' | 'cancelled';
  note: string | null;
  totalCost: string;
  priceCents: number;
  shippingAddressId: number;
  trackingNumber: string | null;
  created: string;
  totalItems: number;
  items: OrderItemDetail[];
}

// GET /api/users/profile
export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await fetch('/api/users/profile', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to fetch profile (Status ${res.status})`);
  }
  return data.data;
}

// PATCH /api/users/profile
export async function updateUserProfile(payload: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}): Promise<UserProfile> {
  const res = await fetch('/api/users/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to update profile (Status ${res.status})`);
  }
  return data.data;
}

// POST /api/users/change-password
export async function changeUserPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/users/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to change password (Status ${res.status})`);
  }
  return data.data;
}

// GET /api/users/addresses
export async function fetchUserAddresses(): Promise<AddressItem[]> {
  const res = await fetch('/api/users/addresses', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to fetch addresses (Status ${res.status})`);
  }
  return data.data || [];
}

// POST /api/users/addresses
export async function createUserAddress(
  payload: Omit<AddressItem, 'addressId' | 'userId'>
): Promise<AddressItem> {
  const res = await fetch('/api/users/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to save address (Status ${res.status})`);
  }
  return data.data;
}

// PATCH /api/users/addresses/[id]
export async function updateUserAddress(
  id: number,
  payload: Partial<Omit<AddressItem, 'addressId' | 'userId'>>
): Promise<AddressItem> {
  const res = await fetch(`/api/users/addresses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to update address (Status ${res.status})`);
  }
  return data.data;
}

// DELETE /api/users/addresses/[id]
export async function deleteUserAddress(id: number): Promise<void> {
  const res = await fetch(`/api/users/addresses/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to delete address (Status ${res.status})`);
  }
}

// GET /api/users/orders
export async function fetchUserOrders(
  page = 1,
  limit = 10
): Promise<{ orders: UserOrder[]; total: number }> {
  const res = await fetch(`/api/users/orders?page=${page}&limit=${limit}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `Failed to load orders (Status ${res.status})`);
  }
  return data.data || { orders: [], total: 0 };
}