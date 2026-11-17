// server/src/modules/passkeys/passkey-service.ts
// Passkeys (WebAuthn, SCRUM-214): sign in with Face ID, Touch ID, Windows Hello, an Android screen
// lock or a security key, for customers and staff.
//
// How it fits with passwords and two-step sign-in:
//   - A passkey is added from a signed-in session AND the account password (a stolen session
//     must not be able to plant its own passkey and keep access after a password change).
//   - Signing in with a passkey replaces both the password and the second step. The device
//     checks the person (fingerprint, face or PIN: `userVerification: 'required'`) and proves it
//     holds the private key, which is two factors in one and can't be phished: the browser only
//     uses a passkey on the site it was made for.
//   - Only the public key is stored (table `passkeys`).
//
// The challenge between "options" and "verify" lives in a short-lived signed cookie, so nothing
// extra is written to the database for an abandoned attempt.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { db } from '../../../db';
import { passkeys } from '../../../db/schema';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error';
import { rateLimit } from '../../shared/security/rate-limit';
import { comparePassword } from '../../shared/utils/hash-utils';
import { JWT_ISSUER } from '../../shared/utils/token-util';
import { logActivity } from '../activity/activity-log';
import { loadMfaAccount, type MfaKind } from '../mfa/mfa-service';
import { alertPasskeyChanged } from '../mfa/security-alerts';
import { deviceName, relyingParty } from './passkey-helpers';

export { deviceName, relyingParty } from './passkey-helpers';

export const PASSKEY_COOKIE = 'pk_challenge';
const CHALLENGE_SECONDS = 5 * 60;
const AUDIENCE = 'bookworms:passkey-challenge';
const ISSUER = JWT_ISSUER;
/** Enough for a phone, a laptop and a security key, with room to spare */
const MAX_PER_ACCOUNT = 10;

export const passkeyCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api',
  maxAge: CHALLENGE_SECONDS,
};

const actorType = (kind: MfaKind) => (kind === 'customer' ? 'customer' : 'admin') as 'customer' | 'admin';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET is missing or shorter than 32 characters');
  return s;
}

// --- the challenge cookie -----------------------------------------------------------------------

type ChallengePurpose = 'register' | 'sign-in';
interface Challenge { challenge: string; purpose: ChallengePurpose; kind: MfaKind; id?: number; rpID: string }

function signChallenge(c: Challenge): string {
  return jwt.sign({ c: c.challenge, p: c.purpose, k: c.kind, rp: c.rpID, ...(c.id ? { sub: String(c.id) } : {}) }, secret(), {
    algorithm: 'HS256', expiresIn: CHALLENGE_SECONDS, issuer: ISSUER, audience: AUDIENCE,
  });
}

function readChallenge(token: string | undefined, purpose: ChallengePurpose, kind: MfaKind): Challenge {
  const expired = new BadRequestError('That took too long. Try again.');
  if (!token) throw expired;
  try {
    const p = jwt.verify(token, secret(), { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE }) as jwt.JwtPayload;
    if (p.p !== purpose || p.k !== kind || typeof p.c !== 'string' || typeof p.rp !== 'string') throw new Error('mismatch');
    return { challenge: p.c, purpose, kind, rpID: p.rp, id: p.sub ? Number(p.sub) : undefined };
  } catch {
    throw expired;
  }
}

/** A stable, opaque WebAuthn user handle per account (no email or database id inside). */
function userHandle(kind: MfaKind, id: number): Uint8Array<ArrayBuffer> {
  const digest = crypto.createHmac('sha256', secret()).update(`passkey-user:${kind}:${id}`).digest();
  return new Uint8Array(digest);
}

const parseTransports = (s: string | null) =>
  (s ? s.split(',').filter(Boolean) : []) as AuthenticatorTransportFuture[];

// --- listing ------------------------------------------------------------------------------------

export async function listPasskeys(kind: MfaKind, id: number) {
  const rows = await db
    .select({ passkeyId: passkeys.passkeyId, name: passkeys.name, created: passkeys.created, lastUsedAt: passkeys.lastUsedAt, backedUp: passkeys.backedUp })
    .from(passkeys)
    .where(and(eq(passkeys.actorType, actorType(kind)), eq(passkeys.actorId, id)))
    .orderBy(passkeys.created);
  return rows;
}

// --- adding one ---------------------------------------------------------------------------------

export async function registrationOptions(kind: MfaKind, id: number, requestUrl: string) {
  const a = await loadMfaAccount(kind, id);
  if (!a || !a.isActive) throw new UnauthorizedError('Please sign in again');
  const existing = await db.select({ credentialId: passkeys.credentialId, transports: passkeys.transports }).from(passkeys)
    .where(and(eq(passkeys.actorType, actorType(kind)), eq(passkeys.actorId, id)));
  if (existing.length >= MAX_PER_ACCOUNT) throw new BadRequestError(`You can have up to ${MAX_PER_ACCOUNT} passkeys. Remove one first.`);

  const { rpID } = relyingParty(requestUrl);
  const options = await generateRegistrationOptions({
    rpName: kind === 'staff' ? 'Book Worms staff' : 'Book Worms',
    rpID,
    userID: userHandle(kind, id),
    userName: a.email,
    userDisplayName: a.firstName,
    attestationType: 'none',
    // The same device can't be added twice
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: parseTransports(p.transports) })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  return { options, cookie: signChallenge({ challenge: options.challenge, purpose: 'register', kind, id, rpID }) };
}

export const addPasskeySchema = z.object({
  response: z.object({ id: z.string().min(1).max(1024) }).passthrough(),
  name: z.string().trim().max(64).optional(),
  password: z.string().min(1, 'Enter your password').max(200),
});

export async function addPasskey(
  kind: MfaKind, id: number, input: z.infer<typeof addPasskeySchema>,
  challengeCookie: string | undefined, requestUrl: string, userAgent: string | null, ip: string | null
) {
  await rateLimit(`passkey:add:${actorType(kind)}:${id}`, 10, 15 * 60);
  const a = await loadMfaAccount(kind, id);
  if (!a || !a.isActive) throw new UnauthorizedError('Please sign in again');
  if (!(await comparePassword(input.password, a.passwordHash))) {
    await logActivity(actorType(kind), id, 'security.settings_wrong_password', { setting: 'passkeys' }, ip);
    throw new UnauthorizedError('That password isn\'t right. No passkey was added.');
  }
  const c = readChallenge(challengeCookie, 'register', kind);
  if (c.id !== id) throw new BadRequestError('That took too long. Try again.');
  const { rpID, origin } = relyingParty(requestUrl);
  if (c.rpID !== rpID) throw new BadRequestError('That took too long. Try again.');

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response as unknown as RegistrationResponseJSON,
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    console.warn('[passkey] registration rejected', (err as Error).message);
    throw new BadRequestError('Your device\'s answer didn\'t check out. Try again.');
  }
  if (!verification.verified || !verification.registrationInfo) throw new BadRequestError('Your device\'s answer didn\'t check out. Try again.');

  const { credential, credentialBackedUp } = verification.registrationInfo;
  const name = input.name?.trim() || deviceName(userAgent);
  try {
    await db.insert(passkeys).values({
      actorType: actorType(kind),
      actorId: id,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      signCount: credential.counter,
      transports: (credential.transports ?? []).join(',') || null,
      name,
      backedUp: credentialBackedUp,
    });
  } catch {
    throw new BadRequestError('That passkey is already on an account.');
  }
  // Logged as security.passkey_added (with whether the email went out) by the alert
  await alertPasskeyChanged({ kind, id, email: a.email, firstName: a.firstName }, 'added', name, ip);
  return { name };
}

// --- removing one -------------------------------------------------------------------------------

export const removePasskeySchema = z.object({ password: z.string().min(1, 'Enter your password').max(200) });

export async function removePasskey(kind: MfaKind, id: number, passkeyId: number, password: string, ip: string | null) {
  await rateLimit(`passkey:remove:${actorType(kind)}:${id}`, 10, 15 * 60);
  const a = await loadMfaAccount(kind, id);
  if (!a || !a.isActive) throw new UnauthorizedError('Please sign in again');
  if (!(await comparePassword(password, a.passwordHash))) {
    await logActivity(actorType(kind), id, 'security.settings_wrong_password', { setting: 'passkeys' }, ip);
    throw new UnauthorizedError('That password isn\'t right. Nothing was removed.');
  }
  const [row] = await db.select({ name: passkeys.name }).from(passkeys)
    .where(and(eq(passkeys.passkeyId, passkeyId), eq(passkeys.actorType, actorType(kind)), eq(passkeys.actorId, id)));
  if (!row) throw new BadRequestError('That passkey isn\'t on your account.');
  await db.delete(passkeys).where(and(eq(passkeys.passkeyId, passkeyId), eq(passkeys.actorType, actorType(kind)), eq(passkeys.actorId, id)));
  await alertPasskeyChanged({ kind, id, email: a.email, firstName: a.firstName }, 'removed', row.name, ip);
}

/** Every passkey of an account goes when the account is deleted or anonymised. */
export async function deleteAllPasskeys(kind: MfaKind, id: number) {
  await db.delete(passkeys).where(and(eq(passkeys.actorType, actorType(kind)), eq(passkeys.actorId, id)));
}

// --- signing in ---------------------------------------------------------------------------------

export async function signInOptions(kind: MfaKind, requestUrl: string, ip: string | null) {
  await rateLimit(`passkey:options:ip:${ip ?? 'unknown'}`, 30, 15 * 60);
  const { rpID } = relyingParty(requestUrl);
  // No allowCredentials: the device offers whichever passkeys it holds for this site
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  return { options, cookie: signChallenge({ challenge: options.challenge, purpose: 'sign-in', kind, rpID }) };
}

export const signInSchema = z.object({
  kind: z.enum(['customer', 'staff']).default('customer'),
  response: z.object({ id: z.string().min(1).max(1024) }).passthrough(),
});

/** Checks the device's signature. Returns who signed in; the caller issues the session. */
export async function verifySignIn(kind: MfaKind, response: AuthenticationResponseJSON, challengeCookie: string | undefined, requestUrl: string, ip: string | null) {
  await rateLimit(`passkey:verify:ip:${ip ?? 'unknown'}`, 30, 15 * 60);
  const c = readChallenge(challengeCookie, 'sign-in', kind);
  const { rpID, origin } = relyingParty(requestUrl);
  const refuse = new UnauthorizedError('That passkey didn\'t work here. Sign in with your password instead.');
  if (c.rpID !== rpID) throw refuse;

  const [pk] = await db.select().from(passkeys).where(eq(passkeys.credentialId, response.id)).limit(1);
  // A customer passkey can't open the staff portal and vice versa
  if (!pk || pk.actorType !== actorType(kind)) throw refuse;
  const a = await loadMfaAccount(kind, pk.actorId);
  if (!a || !a.isActive) throw refuse;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: c.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: pk.credentialId, publicKey: isoBase64URL.toBuffer(pk.publicKey), counter: pk.signCount, transports: parseTransports(pk.transports) },
    });
  } catch (err) {
    console.warn('[passkey] sign-in rejected', (err as Error).message);
    verification = null;
  }
  if (!verification?.verified) {
    await logActivity(actorType(kind), pk.actorId, 'security.passkey_failed', { name: pk.name }, ip);
    throw refuse;
  }
  await db.update(passkeys).set({ signCount: verification.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(passkeys.passkeyId, pk.passkeyId));
  return { kind, id: pk.actorId, passkeyName: pk.name };
}
