/**
 * The lock keys for one account: its password sign-in (by email), its sign-in code step, and the
 * owner's "Lock My Account" lock (which also stops passkey sign-in; see relockKey).
 */
export function signInLockKeys(kind: 'customer' | 'staff', id: number, email: string): string[] {
  const e = email.trim().toLowerCase();
  const base = kind === 'customer' ? [`login:email:${e}`, `mfa:customer:${id}`] : [`staff-login:email:${e}`, `mfa:admin:${id}`];
  return [...base, relockKey(kind, id)];
}

/** Set only by "Lock My Account". Unlike a wrong-password lock, it also blocks passkeys. */
export function relockKey(kind: 'customer' | 'staff', id: number): string {
  return `relock:${kind}:${id}`;
}
