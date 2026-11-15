// server/src/modules/mfa/mfa-service.ts
// Two-step sign-in for customers (optional) and staff (required).
//
// Flow: the password is checked as before (auth-service.ts / staff-auth.ts). When the account
// needs a second step, no session cookie is set. Instead the browser gets a short-lived
// "pending" token in an httpOnly cookie (path /api/mfa only) and is asked for a code:
//   - email:  a 6-digit code is emailed; only its hash is stored (mfa_challenges), it lasts
//             10 minutes, works once, and dies after 5 wrong tries;
//   - totp:   the code from an authenticator app (totp.ts); the secret is stored encrypted
//             (secret-box.ts) and a used 30-second window can't be replayed.
// Someone using an authenticator can ask for an email code instead (a lost phone shouldn't lock
// them out of a class-project shop). Wrong codes count towards the same kind of 15-minute
// lockout as wrong passwords, and every step is in the activity log.
//
// Demo accounts: the seeded demo customers and staff use @example.com addresses, which no one
// can receive. Their codes are sent to the shared support inbox (SUPPORT_EMAIL) instead, with a
// note saying which account they are for, so the demo still works.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../../db';
import { admin, mfaChallenges, users } from '../../../db/schema';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error';
import { JWT_ISSUER } from '../../shared/utils/token-util';
import { comparePassword } from '../../shared/utils/hash-utils';
import { assertNotLocked, clearFailures, rateLimit, recordFailure } from '../../shared/security/rate-limit';
import { logActivity } from '../activity/activity-log';
import { sendEmail } from '../email/mailer';
import { signInCodeEmail } from '../email/templates';
import { openSecret, sealSecret } from './secret-box';
import { generateTotpSecret, totpUri, verifyTotp } from './totp';
import { alertMfaChanged, type AlertActor } from './security-alerts';

export type MfaKind = 'customer' | 'staff';
export type MfaMethod = 'none' | 'email' | 'totp';

export const MFA_PENDING_COOKIE = 'mfa_pending';
const PENDING_AUDIENCE = 'mfa-pending';
const SETUP_AUDIENCE = 'mfa-setup';
const PENDING_SECONDS = 10 * 60;
const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;

export const mfaCodeSchema = z.object({
  code: z.string().trim().min(6, 'Enter the 6-digit code').max(12, 'Enter the 6-digit code'),
});

const actorType = (kind: MfaKind) => (kind === 'customer' ? 'customer' : 'admin') as 'customer' | 'admin';

// --- the account, whichever table it lives in -------------------------------------------------

export interface MfaAccount {
  kind: MfaKind;
  id: number;
  email: string;
  firstName: string;
  isActive: boolean;
  tokenVersion: number;
  passwordHash: string;
  mfaMethod: MfaMethod;
  totpSecret: string | null;
  totpLastStep: number | null;
}

export async function loadMfaAccount(kind: MfaKind, id: number): Promise<MfaAccount | null> {
  if (kind === 'customer') {
    const [u] = await db.select().from(users).where(eq(users.userId, id)).limit(1);
    return u ? { kind, id: u.userId, email: u.email, firstName: u.firstName, isActive: u.isActive, tokenVersion: u.tokenVersion, passwordHash: u.passwordHash, mfaMethod: u.mfaMethod, totpSecret: u.totpSecret, totpLastStep: u.totpLastStep } : null;
  }
  const [a] = await db.select().from(admin).where(eq(admin.adminId, id)).limit(1);
  return a ? { kind, id: a.adminId, email: a.email, firstName: a.firstName, isActive: a.isActive, tokenVersion: a.tokenVersion, passwordHash: a.passwordHash, mfaMethod: a.mfaMethod, totpSecret: a.totpSecret, totpLastStep: a.totpLastStep } : null;
}

async function saveMfa(kind: MfaKind, id: number, values: { mfaMethod?: MfaMethod; totpSecret?: string | null; totpLastStep?: number | null }) {
  if (kind === 'customer') {
    await db.update(users).set(values).where(eq(users.userId, id));
  } else {
    // Staff can't turn it off: the column only allows email or totp
    const { mfaMethod, ...rest } = values;
    if (mfaMethod === 'none') throw new BadRequestError('Two-step sign-in is required for staff accounts');
    await db.update(admin).set({ ...rest, ...(mfaMethod ? { mfaMethod } : {}) }).where(eq(admin.adminId, id));
  }
}

const alertActor = (a: MfaAccount): AlertActor => ({ kind: a.kind, id: a.id, email: a.email, firstName: a.firstName });

/** Does this account have to pass a second step before it gets a session? */
export function needsSecondStep(a: Pick<MfaAccount, 'kind' | 'mfaMethod' | 'totpSecret'>): boolean {
  if (a.kind === 'staff') return true;
  return a.mfaMethod === 'email' || (a.mfaMethod === 'totp' && !!a.totpSecret);
}

/** The method actually used at sign-in (an authenticator with no secret falls back to email). */
function effectiveMethod(a: Pick<MfaAccount, 'mfaMethod' | 'totpSecret'>): 'email' | 'totp' {
  return a.mfaMethod === 'totp' && a.totpSecret ? 'totp' : 'email';
}

/** "a•••@example.com", enough to recognise the inbox without spelling it out. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';
  return `${local.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(5, local.length - 1)))}@${domain}`;
}

// --- the pending token ------------------------------------------------------------------------

interface PendingPayload { kind: MfaKind; id: number; tv: number; rem: boolean; via: 'email' | 'totp' }

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  return s;
}

function signPending(p: PendingPayload): string {
  return jwt.sign({ k: p.kind, tv: p.tv, rem: p.rem, via: p.via }, secret(), {
    algorithm: 'HS256', expiresIn: PENDING_SECONDS, issuer: JWT_ISSUER, audience: PENDING_AUDIENCE, subject: String(p.id),
  } as jwt.SignOptions);
}

function readPending(token: string | undefined): PendingPayload {
  if (!token) throw new UnauthorizedError('Your sign-in timed out. Enter your password again.');
  try {
    const p = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: PENDING_AUDIENCE }) as jwt.JwtPayload;
    const kind = p.k === 'staff' ? 'staff' : p.k === 'customer' ? 'customer' : null;
    const id = Number(p.sub);
    if (!kind || !Number.isInteger(id) || id <= 0) throw new Error('bad payload');
    return { kind, id, tv: Number(p.tv), rem: !!p.rem, via: p.via === 'totp' ? 'totp' : 'email' };
  } catch {
    throw new UnauthorizedError('Your sign-in timed out. Enter your password again.');
  }
}

export const pendingCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/mfa',
  maxAge: PENDING_SECONDS,
};

// --- email codes ------------------------------------------------------------------------------

const hashCode = (kind: MfaKind, id: number, code: string) => createHash('sha256').update(`${actorType(kind)}:${id}:${code}`).digest('hex');

/** Where a code for this address is delivered (demo @example.com accounts: the support inbox). */
export function codeDestination(email: string): { to: string; redirectedFor?: string } {
  const support = process.env.SUPPORT_EMAIL;
  if (support && /@example\.com$/i.test(email)) return { to: support, redirectedFor: email };
  return { to: email };
}

async function sendEmailCode(a: MfaAccount, ip: string | null) {
  await rateLimit(`mfa:send:${actorType(a.kind)}:${a.id}`, 6, 15 * 60);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  // Only the newest code works: older unused ones are retired
  await db.update(mfaChallenges).set({ usedAt: new Date() })
    .where(and(eq(mfaChallenges.actorType, actorType(a.kind)), eq(mfaChallenges.actorId, a.id), isNull(mfaChallenges.usedAt)));
  await db.insert(mfaChallenges).values({
    actorType: actorType(a.kind), actorId: a.id, codeHash: hashCode(a.kind, a.id, code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
  });
  const dest = codeDestination(a.email);
  const emailed = await sendEmail(signInCodeEmail(dest.to, a.firstName, code, a.kind, dest.redirectedFor));
  await logActivity(actorType(a.kind), a.id, 'security.mfa_code_sent', { method: 'email', emailed, demoInbox: !!dest.redirectedFor }, ip);
}

async function checkEmailCode(a: MfaAccount, code: string): Promise<boolean> {
  const [c] = await db.select().from(mfaChallenges)
    .where(and(
      eq(mfaChallenges.actorType, actorType(a.kind)), eq(mfaChallenges.actorId, a.id),
      isNull(mfaChallenges.usedAt), gt(mfaChallenges.expiresAt, new Date()),
    ))
    .orderBy(desc(mfaChallenges.challengeId)).limit(1);
  if (!c || c.attempts >= MAX_CODE_ATTEMPTS) return false;
  const digits = code.replace(/\s+/g, '');
  const ok = /^\d{6}$/.test(digits) && timingSafeEqual(Buffer.from(hashCode(a.kind, a.id, digits)), Buffer.from(c.codeHash));
  if (ok) {
    await db.update(mfaChallenges).set({ usedAt: new Date() }).where(eq(mfaChallenges.challengeId, c.challengeId));
  } else {
    await db.update(mfaChallenges).set({ attempts: sql`${mfaChallenges.attempts} + 1` }).where(eq(mfaChallenges.challengeId, c.challengeId));
  }
  return ok;
}

// --- sign-in ----------------------------------------------------------------------------------

export interface SecondStep { pendingToken: string; method: 'email' | 'totp'; sentTo: string | null }

/** After a correct password: send a code if needed and hand back the pending token. */
export async function beginSecondStep(kind: MfaKind, id: number, remember: boolean, ip: string | null): Promise<SecondStep> {
  const a = await loadMfaAccount(kind, id);
  if (!a) throw new UnauthorizedError('Please sign in again');
  const method = effectiveMethod(a);
  if (method === 'email') await sendEmailCode(a, ip);
  const dest = codeDestination(a.email);
  return {
    pendingToken: signPending({ kind, id, tv: a.tokenVersion, rem: remember, via: method }),
    method,
    sentTo: method === 'email' ? (dest.redirectedFor ? 'the shared support inbox (demo account)' : maskEmail(a.email)) : null,
  };
}

/** "Send me an email code instead" / "Resend the code". Returns a new pending token. */
export async function resendEmailCode(pendingToken: string | undefined, ip: string | null): Promise<SecondStep> {
  const p = readPending(pendingToken);
  const a = await loadMfaAccount(p.kind, p.id);
  if (!a || !a.isActive || a.tokenVersion !== p.tv) throw new UnauthorizedError('Please sign in again');
  await sendEmailCode(a, ip);
  const dest = codeDestination(a.email);
  return {
    pendingToken: signPending({ ...p, via: 'email' }),
    method: 'email',
    sentTo: dest.redirectedFor ? 'the shared support inbox (demo account)' : maskEmail(a.email),
  };
}

/** Checks the code. On success returns who signed in; the caller issues the real session. */
export async function verifySecondStep(pendingToken: string | undefined, code: string, ip: string | null) {
  await rateLimit(`mfa:verify:ip:${ip ?? 'unknown'}`, 30, 15 * 60);
  const p = readPending(pendingToken);
  const a = await loadMfaAccount(p.kind, p.id);
  // A password change or "sign out everywhere" since the password step voids the pending token
  if (!a || !a.isActive || a.tokenVersion !== p.tv) throw new UnauthorizedError('Please sign in again');

  const lockKey = `mfa:${actorType(a.kind)}:${a.id}`;
  await assertNotLocked(lockKey);

  let ok = false;
  if (p.via === 'totp' && a.totpSecret) {
    const step = verifyTotp(openSecret(a.totpSecret), code, a.totpLastStep);
    if (step !== null) {
      // Conditional update: two requests racing with the same code can't both win
      const table = a.kind === 'customer' ? users : admin;
      const idCol = a.kind === 'customer' ? users.userId : admin.adminId;
      const [res] = await db.update(table).set({ totpLastStep: step })
        .where(and(eq(idCol, a.id), sql`(${table.totpLastStep} IS NULL OR ${table.totpLastStep} < ${step})`)) as unknown as [{ affectedRows: number }];
      ok = res.affectedRows > 0;
    }
  } else {
    ok = await checkEmailCode(a, code);
  }

  if (!ok) {
    const locked = await recordFailure(lockKey);
    await logActivity(actorType(a.kind), a.id, 'security.mfa_failed', { method: p.via, locked }, ip);
    throw new UnauthorizedError(locked
      ? 'Too many wrong codes. Sign-in is paused for 15 minutes.'
      : 'That code isn\'t right or has expired. Check it and try again, or send a new one.');
  }
  await clearFailures(lockKey);
  await logActivity(actorType(a.kind), a.id, 'security.mfa_verified', { method: p.via }, ip);
  return { kind: a.kind, id: a.id, remember: p.rem };
}

// --- settings (turning it on and off) ---------------------------------------------------------

export const mfaSettingsSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('begin_totp') }),
  z.object({ action: z.literal('confirm_totp'), setupToken: z.string().min(20).max(2048), code: z.string().trim().min(6).max(12), password: z.string().min(1, 'Enter your password').max(200) }),
  z.object({ action: z.literal('use_email'), password: z.string().min(1, 'Enter your password').max(200) }),
  z.object({ action: z.literal('disable'), password: z.string().min(1, 'Enter your password').max(200) }),
]);

export async function mfaStatus(kind: MfaKind, id: number) {
  const a = await loadMfaAccount(kind, id);
  if (!a) throw new UnauthorizedError('Please sign in again');
  const method: MfaMethod = a.kind === 'customer' && a.mfaMethod === 'none' ? 'none' : effectiveMethod(a);
  return { method, required: kind === 'staff', email: maskEmail(a.email) };
}

async function confirmPassword(a: MfaAccount, password: string, ip: string | null) {
  await rateLimit(`mfa:settings:${actorType(a.kind)}:${a.id}`, 10, 15 * 60);
  if (!(await comparePassword(password, a.passwordHash))) {
    await logActivity(actorType(a.kind), a.id, a.kind === 'staff' ? 'staff.step_up_failed' : 'security.mfa_failed', { reason: 'wrong password on two-step settings' }, ip);
    throw new UnauthorizedError('That password isn\'t right. Nothing was changed.');
  }
}

/**
 * begin_totp:   makes a new secret and returns the QR code plus a setup token (nothing saved)
 * confirm_totp: the first code from the app proves it was scanned; then it becomes the method
 * use_email:    switch to emailed codes
 * disable:      customers only: password-only sign-in again
 * Every change but begin_totp needs the current password and sends a security alert.
 */
export async function changeMfaSettings(kind: MfaKind, id: number, input: z.infer<typeof mfaSettingsSchema>, ip: string | null) {
  const a = await loadMfaAccount(kind, id);
  if (!a || !a.isActive) throw new UnauthorizedError('Please sign in again');
  const before: MfaMethod = a.kind === 'customer' && a.mfaMethod === 'none' ? 'none' : effectiveMethod(a);

  if (input.action === 'begin_totp') {
    await rateLimit(`mfa:begin:${actorType(kind)}:${id}`, 10, 15 * 60);
    const plain = generateTotpSecret();
    // Nothing is saved yet: the new secret travels (encrypted, signed, 15 minutes) in a setup
    // token the browser sends back with the first code. Abandoning setup changes nothing.
    const setupToken = jwt.sign({ k: kind, s: sealSecret(plain) }, secret(), {
      algorithm: 'HS256', expiresIn: 15 * 60, issuer: JWT_ISSUER, audience: SETUP_AUDIENCE, subject: String(id),
    } as jwt.SignOptions);
    const uri = totpUri(plain, a.email);
    const QRCode = (await import('qrcode')).default;
    const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return { secret: plain, uri, qrSvg, setupToken };
  }

  await confirmPassword(a, input.password, ip);

  if (input.action === 'confirm_totp') {
    let sealed: string;
    try {
      const t = jwt.verify(input.setupToken, secret(), { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: SETUP_AUDIENCE }) as jwt.JwtPayload;
      if (t.k !== kind || Number(t.sub) !== id || typeof t.s !== 'string') throw new Error('not yours');
      sealed = t.s;
    } catch {
      throw new BadRequestError('The setup timed out. Start the authenticator setup again.');
    }
    const step = verifyTotp(openSecret(sealed), input.code, null);
    if (step === null) throw new BadRequestError('That code doesn\'t match. Make sure your phone sets its time automatically, then try the newest code.');
    await saveMfa(kind, id, { mfaMethod: 'totp', totpSecret: sealed, totpLastStep: step });
    await alertMfaChanged(alertActor(a), before, 'totp', ip);
    return { method: 'totp' as MfaMethod };
  }
  if (input.action === 'use_email') {
    await saveMfa(kind, id, { mfaMethod: 'email', totpSecret: null, totpLastStep: null });
    if (before !== 'email') await alertMfaChanged(alertActor(a), before, 'email', ip);
    return { method: 'email' as MfaMethod };
  }
  // disable
  if (kind === 'staff') throw new BadRequestError('Two-step sign-in is required for staff accounts');
  await saveMfa(kind, id, { mfaMethod: 'none', totpSecret: null, totpLastStep: null });
  if (before !== 'none') await alertMfaChanged(alertActor(a), before, 'none', ip);
  return { method: 'none' as MfaMethod };
}
