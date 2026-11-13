/**
 * Authentication Client Service
 * Calls the Next.js auth API routes. Every route answers with the shape from
 * server/src/shared/http/api-response.ts:
 *   success: { success: true,  message, data }
 *   failure: { success: false, error }
 * The JWT itself lives in the httpOnly `auth_token` cookie, so the browser sends it
 * automatically (credentials: 'include'); client code never needs to read it.
 */

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/** Matches registerInputSchema in server/src/modules/auth/auth-schema.ts */
export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UserSession {
  id: string | number;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string | null;
  role: 'customer' | 'admin' | string;
  createdAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export class AuthApiError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

/**
 * Converts the server's SanitizedUser (auth-service.ts) into the client session shape.
 */
function toUserSession(raw: any): UserSession | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.userId ?? raw.id;
  if (id === undefined || id === null || !raw.email) return null;

  const name =
    raw.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || raw.email.split('@')[0];

  return {
    id,
    name,
    firstName: raw.firstName,
    lastName: raw.lastName,
    email: raw.email,
    phone: raw.phone ?? null,
    role: raw.role || 'customer',
    createdAt: raw.created ?? raw.createdAt,
  };
}

/** Parses JSON without throwing when the server sent something else (e.g. an HTML error page). */
async function readJson<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return null;
  }
}

/**
 * Shared POST for login/register: returns the user on success, throws AuthApiError with
 * the server's error message on failure.
 */
async function postAuth(
  url: string,
  body: unknown,
  fallbackError: (status: number) => string
): Promise<{ user: UserSession }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError('Network connection failed. Please try again later.', 0);
  }

  const payload = await readJson<{ user: unknown }>(res);

  if (!res.ok || !payload?.success) {
    throw new AuthApiError(payload?.error || payload?.message || fallbackError(res.status), res.status);
  }

  const user = toUserSession(payload.data?.user);
  if (!user) {
    throw new AuthApiError('Unexpected response from the server.', res.status);
  }
  return { user };
}

/**
 * POST /api/auth/login
 */
export async function loginUser(payload: LoginPayload): Promise<{ user: UserSession }> {
  return postAuth(
    '/api/auth/login',
    { email: payload.email, password: payload.password, rememberMe: payload.rememberMe },
    (status) => (status === 401 ? 'Invalid email address or password.' : 'Failed to authenticate.')
  );
}

/**
 * POST /api/auth/register
 */
export async function registerUser(payload: RegisterPayload): Promise<{ user: UserSession }> {
  const body: RegisterPayload = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    password: payload.password,
  };
  if (payload.phone && payload.phone.trim()) {
    body.phone = payload.phone.trim();
  }

  return postAuth('/api/auth/register', body, (status) =>
    status === 409
      ? 'An account with this email already exists. Please sign in instead.'
      : 'Registration failed.'
  );
}

/**
 * GET /api/auth/me
 * Returns the signed-in user, or null when there is no valid session
 * (the server answers { success: true, data: { user: null } } in that case).
 */
export async function fetchCurrentSession(): Promise<UserSession | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const payload = await readJson<{ user: unknown }>(res);
    if (!payload?.success) return null;

    return toUserSession(payload.data?.user);
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/logout — the server clears the auth_token cookie.
 */
export async function logoutUser(): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}
