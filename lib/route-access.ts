// Which pages the proxy sends to the sign-in page when there is no customer session.
// Kept apart from proxy.ts so the decision can be unit-tested without a request.
//
// This is a convenience redirect, not the security boundary: every API route checks its own
// access, and these pages are client components that only show what those APIs return.

export const PROTECTED_PREFIXES = ['/account', '/checkout', '/orders'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * True when `pathname` needs a signed-in customer.
 *
 * Guest checkout (SCRUM-208) needs three checkout pages to load without an account:
 *   /checkout                      - the page serves guests and signed-in customers alike
 *   /checkout/success?guest=1      - where Stripe returns a guest; it is what completes the
 *                                    order (stock, confirmation email, test-payment refund)
 *   /checkout/guest-order          - the emailed order link, gated by its signed token
 * Their data comes from the guest APIs, which re-price server-side, rate-limit, and read the
 * order id only from a signed single-order token. The signed-in completion page
 * (/checkout/success without guest=1) still requires a session, as before.
 */
export function requiresCustomerSession(pathname: string, search: URLSearchParams): boolean {
  if (!startsWithAny(pathname, PROTECTED_PREFIXES)) return false;
  if (pathname === '/checkout') return false;
  if (pathname === '/checkout/guest-order') return false;
  if (pathname === '/checkout/success' && search.get('guest') === '1') return false;
  return true;
}
