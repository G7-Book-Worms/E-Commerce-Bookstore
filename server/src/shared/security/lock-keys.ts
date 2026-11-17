/** The lock keys for one account: its password sign-in (by email) and its sign-in code step. */
export function signInLockKeys(kind: 'customer' | 'staff', id: number, email: string): string[] {
  const e = email.trim().toLowerCase();
  return kind === 'customer' ? [`login:email:${e}`, `mfa:customer:${id}`] : [`staff-login:email:${e}`, `mfa:admin:${id}`];
}
