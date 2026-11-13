// Client helper for the staff portal's API calls: JSON in, { ok, data, message } out.
export async function staffFetch<T = Record<string, unknown>>(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    // Session expired while using the portal: back to sign in (but not for the sign-in form itself)
    if (res.status === 401 && !url.endsWith('/api/staff/login')) window.location.href = '/staff-login';
    return {
      ok: res.ok && json?.success !== false,
      data: (json?.data ?? null) as T | null,
      message: (json?.success === false ? json?.error : json?.message) ?? (res.ok ? 'Done' : 'Something went wrong'),
    };
  } catch {
    return { ok: false, data: null, message: 'Network error. Try again.' };
  }
}
