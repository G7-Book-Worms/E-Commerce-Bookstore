/**
 * Authentication Client Service
 * Dispatches requests to Next.js API endpoints and parses structured error payloads.
 */

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}
// lib/api/auth.ts

export interface UserSession {
  id: string | number;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string; // Add this line
  role: 'customer' | 'admin' | string;
  createdAt?: string;
}

export interface AuthSuccessResponse {
  success?: boolean;
  status?: string;
  message?: string;
  data: {
    user: UserSession;
    token?: string;
  };
}

export class AuthApiError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/**
 * Executes login request against backend API
 * POST /api/auth/login
 */
export async function loginUser(payload: LoginPayload): Promise<{ user: UserSession; token?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        rememberMe: payload.rememberMe,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMessage =
        data?.message ||
        data?.error ||
        (res.status === 401 ? 'Invalid email address or password.' : 'Failed to authenticate.');
      throw new AuthApiError(errorMessage, res.status);
    }

    // Safely extract user whether wrapped in data.data or data directly
    const sessionData = data?.data?.user ? data.data : { user: data?.user || data?.data };
    return sessionData;
  } catch (error: any) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError('Network connection failed. Please try again later.', 0);
  }
}

/**
 * Executes registration request against backend API
 * POST /api/auth/register
 */
export async function registerUser(payload: RegisterPayload): Promise<{ user: UserSession; token?: string }> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMessage =
        data?.message ||
        data?.error ||
        (res.status === 409
          ? 'An account with this email already exists. Please sign in instead.'
          : 'Registration failed.');
      throw new AuthApiError(errorMessage, res.status);
    }

    const sessionData = data?.data?.user ? data.data : { user: data?.user || data?.data };
    return sessionData;
  } catch (error: any) {
    if (error instanceof AuthApiError) throw error;
    throw new AuthApiError('Network connection failed. Please try again later.', 0);
  }
}

/**
 * Checks current session validity via GET /api/auth/me
 */
// lib/api/auth.ts
// lib/api/auth.ts

export async function fetchCurrentSession(): Promise<UserSession | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    const payload = await res.json();

    // Check if the backend returns { user: null } or { authenticated: false }
    if (payload?.authenticated === false) {
      return null;
    }

    // Unpack user object regardless of how the controller wrapped it
    const rawUser = payload?.data?.user ?? payload?.data ?? payload?.user;

    // Strict guard: Must be an object and have an identifier
    if (!rawUser || typeof rawUser !== 'object') {
      return null;
    }

    const userId = rawUser.userId ?? rawUser.id;
    if (!userId && !rawUser.email) {
      return null;
    }

    const computedName =
      rawUser.name ||
      `${rawUser.firstName || ''} ${rawUser.lastName || ''}`.trim() ||
      rawUser.email?.split('@')[0];

    return {
      id: userId,
      name: computedName || 'User',
      firstName: rawUser.firstName,
      lastName: rawUser.lastName,
      email: rawUser.email,
      phone: rawUser.phone,
      role: rawUser.role || 'customer',
    };
  } catch {
    return null;
  }
}
/**
 * Invalidates session on server by clearing cookies
 */
export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}