// Where to send someone after signing in, from a ?callbackUrl= the URL carried.
// Only a path on this site is accepted: "//evil.com", "/\evil.com" (browsers read a backslash as
// a slash) and anything that resolves to another origin fall back to the default.

export function safeInternalPath(raw: string | null | undefined, fallback = '/', requiredPrefix = '/'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const base = 'https://bookwrms.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
  } catch {
    return fallback;
  }
  if (requiredPrefix !== '/' && raw !== requiredPrefix && !raw.startsWith(`${requiredPrefix}/`) && !raw.startsWith(`${requiredPrefix}?`)) return fallback;
  return raw;
}
