# Security

How Book Worms protects accounts, payments and data. Each item names the file that implements it, so it can be checked in code review and cited in the report (Sommerville ch. 10: dependability and security).

## Passwords

| Measure | Where |
|:--|:--|
| Stored only as **bcrypt** hashes (salted, cost 12). The plain password is never stored or logged. | `server/src/shared/utils/hash-utils.ts` |
| Older cost-10 hashes are upgraded automatically the next time the user signs in. | `auth-service.ts`, `staff-auth.ts` |
| Password rules shared by browser and server: 10+ characters, upper, lower, number, symbol; common passwords (with numbers/symbols around them), sequences and the email name are refused; max 72 bytes (bcrypt's limit). | `lib/password-policy.ts` |
| Strength meter on every "new password" field. | `components/ui/password-strength.tsx` |
| Show/Hide button instead of copy-pasting passwords into other places. | `components/ui/password-input.tsx` |

## Sign-in

| Measure | Where |
|:--|:--|
| **Lockout**: 5 wrong passwords in 15 minutes locks that account for 15 minutes (customers and staff). | `server/src/shared/security/rate-limit.ts` |
| **Rate limits** per IP on sign-in, sign-up, password reset, contact form and password changes. Counters live in MySQL so they hold across Vercel's serverless instances. | `rate-limit.ts`, `rate_limits` table |
| Same error and similar timing whether or not an email has an account (no account discovery). | `burnHashTime()` in `hash-utils.ts` |
| Staff need email + password + **employee ID**. | `server/src/modules/staff/staff-auth.ts` |
| Deactivated accounts can't sign in. | `auth-service.ts`, `auth-middleware.ts` |

## Sessions

| Measure | Where |
|:--|:--|
| JWT in an **httpOnly** cookie (JavaScript can't read it), `Secure` on HTTPS, `SameSite=Lax` (customers) / `Strict` (staff). | `server/src/shared/utils/cookie-utils.ts` |
| Algorithm pinned to HS256 with issuer and audience checks; customer tokens can't open the staff portal. | `server/src/shared/utils/token-util.ts`, `proxy.ts` |
| Customer sessions last 7 days with "Remember me", otherwise until the browser closes; staff sessions last 8 hours. | `token-util.ts` |
| **Token version**: changing a password, deactivation, or "sign out everywhere" ends every other session immediately. Every API call checks it against the database. | `auth-middleware.ts`, `users.token_version`, `admin.token_version` |

## Password reset

| Measure | Where |
|:--|:--|
| Emailed one-time link, 32 random bytes, valid 30 minutes, single use; only a SHA-256 hash is stored. | `auth-service.ts`, `password_reset_tokens` table |
| Staff can set a temporary password instead (shown once, never emailed); the user must choose a new one at next sign-in. | `customers-admin.ts`, `staff-accounts.ts` |
| "Your password was changed" email after every change. | `server/src/modules/email/templates.ts` |

## Authorization (staff roles)

| Role | Can |
|:--|:--|
| Employee | dashboard, orders (view, ship, cancel), inventory counts (restock, corrections), messages |
| Manager | + prices and sale prices, add/edit books, discount codes, customers, activity log |
| Administrator | + staff accounts |

The table lives in `lib/staff-permissions.ts`. Every staff API (`staffApi()` in `server/src/modules/staff/staff-api.ts`) and every portal page (`requireStaffPage()`) checks it on the server, using the role stored in the database. There is always at least one active administrator, and nobody can change their own role.

## Web protections

| Measure | Where |
|:--|:--|
| **CSRF**: state-changing API requests from another site are refused (Origin / Sec-Fetch-Site check) on top of SameSite cookies. | `proxy.ts` |
| Security headers: Content-Security-Policy, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, HSTS (on the live site). | `next.config.ts` |
| Every input validated with zod; errors never show SQL or stack traces. | `*-schema.ts`, `server/src/server.ts` |
| SQL injection: all queries are parameterized through Drizzle ORM. | `server/src/modules/**` |
| XSS: React escapes output; user text in emails is HTML-escaped. | `templates.ts` |
| Spam trap field on the contact form. | `components/footer/Footer.tsx` |
| Not indexed by search engines (class project). | `public/robots.txt`, `X-Robots-Tag` |

## Payments

Stripe Checkout in **test mode** only: the server refuses live keys, the card is entered on Stripe's page (we never see card numbers, only brand and last 4), the amount is re-checked against the order, and every payment is refunded automatically. See `server/src/modules/payments/stripe.ts` and `checkout-service.ts`.

## Accountability

Every sign-in, failed sign-in, lockout, order, refund, stock change and staff action is written to the activity log with the actor and IP (`server/src/modules/activity/activity-log.ts`), viewable at `/admin/activity`.

## Secrets and hosting

- Secrets live only in `.env` (git-ignored) and Vercel's encrypted environment variables. Production has its own `JWT_SECRET`.
- Database traffic is TLS-encrypted; set `DB_CA_CERT` to also verify Aiven's certificate (`server/db/index.ts`).
- Email is sent over TLS (port 465) from the bookwrms.store domain with SPF and DKIM set up.

## Tests

`pnpm test` includes `password-policy.test.ts`, `hash-utils.test.ts` and `token-util.test.ts` (forged, unsigned and wrong-audience tokens are rejected).

## Known limits / next steps

- Aiven accepts connections from any IP (Vercel has no fixed IPs on the free plan); access still needs the password over TLS. A separate least-privilege database user for the website is planned.
- Passkeys and authenticator-app codes for staff are stretch goals.
