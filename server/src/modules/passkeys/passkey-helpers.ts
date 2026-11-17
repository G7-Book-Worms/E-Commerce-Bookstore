// Pure helpers for passkeys (no database), so they can be unit-tested.

/** The site the passkey belongs to: this deployment's own host name and origin. */
export function relyingParty(requestUrl: string) {
  const url = new URL(requestUrl);
  return { rpID: url.hostname, origin: url.origin };
}

/** A readable default name from the browser's user agent: "iPhone", "Mac (Chrome)"... */
export function deviceName(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'This device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  return browser && !['iPhone', 'iPad'].includes(device) ? `${device} (${browser})` : device;
}
