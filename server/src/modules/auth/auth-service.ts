import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { admin, passwordResetTokens, rateLimits, users } from '../../../db/schema';
import { relockVoidKey } from './relock-token';
import { UsersRepository } from '../users/users-repository';
import { User } from '../users/users-schema';
import { loginInputSchema, registerInputSchema } from './auth-schema';
import { burnHashTime, comparePassword, hashPassword, needsRehash } from '../../shared/utils/hash-utils';
import { generateToken } from '../../shared/utils/token-util';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors/app-error';
import { assertNotLocked, clearFailures, clearLocks, rateLimit, recordFailure, signInLockKeys } from '../../shared/security/rate-limit';
import { logActivity } from '../activity/activity-log';
import { inBackground } from '../../shared/utils/in-background';
import { sendEmail } from '../email/mailer';
import { beginSecondStep, codeDestination, maskEmail, needsSecondStep, type SecondStep } from '../mfa/mfa-service';
import { codeMatches, newCode, readPendingRegistration, signPendingRegistration, withCode, type PendingRegistration } from './email-verification';
import { alertIfNewSignIn, alertLockout } from '../mfa/security-alerts';
import { accountAlreadyExistsEmail, passwordChangedEmail, passwordResetEmail, verifyEmailCodeEmail, welcomeEmail } from '../email/templates';

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;

export interface SanitizedUser {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'customer';
  mustChangePassword: boolean;
  created: Date;
}

const RESET_TOKEN_MINUTES = 30;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export function customerToken(user: Pick<User, 'userId' | 'email' | 'tokenVersion'>, remember = false) {
  return generateToken({ id: user.userId, email: user.email, role: 'customer', tv: user.tokenVersion ?? 0, rem: remember }, 'customer');
}

export class AuthService {
  constructor(private usersRepo = new UsersRepository()) {}

  /**
   * Customer sign-in (SCRUM-213):
   * - per-IP rate limit and per-account lockout after 5 wrong passwords in 15 minutes
   * - same error message and similar timing whether or not the email exists
   * - deactivated accounts can't sign in
   * - old, cheaper bcrypt hashes are upgraded after a successful sign-in
   */
  async login(input: LoginInput, ip: string): Promise<{ user: SanitizedUser; token: string } | { mfa: SecondStep }> {
    const email = input.email.trim().toLowerCase();
    await rateLimit(`login:ip:${ip}`, 30, 15 * 60);
    const lockKey = `login:email:${email}`;
    await assertNotLocked(lockKey);

    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      await burnHashTime(input.password);
      // Unknown emails lock exactly like real ones, so the message can't reveal which exist
      if (await recordFailure(lockKey)) await assertNotLocked(lockKey);
      throw new UnauthorizedError('Incorrect email address or password.');
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      const locked = await recordFailure(lockKey);
      await logActivity('customer', user.userId, locked ? 'auth.locked_out' : 'auth.login_failed', { email }, ip);
      if (locked) {
        await alertLockout({ kind: 'customer', id: user.userId, email: user.email, firstName: user.firstName }, ip);
        // Same lockout message the next attempt gets, so the person knows straight away
        await assertNotLocked(lockKey);
      }
      throw new UnauthorizedError('Incorrect email address or password.');
    }
    if (!user.isActive) {
      throw new UnauthorizedError('This account has been deactivated. For help, contact support@bookwrms.store.');
    }

    await clearFailures(lockKey);
    if (needsRehash(user.passwordHash)) {
      await this.usersRepo.updatePasswordHash(user.userId, await hashPassword(input.password));
    }

    // Two-step sign-in turned on: no session yet, ask for the code first (see ../mfa/mfa-service.ts)
    if (needsSecondStep({ kind: 'customer', mfaMethod: user.mfaMethod, totpSecret: user.totpSecret })) {
      return { mfa: await beginSecondStep('customer', user.userId, !!input.rememberMe, ip) };
    }
    return this.completeSignIn(user, !!input.rememberMe, ip);
  }

  /** The last step of every customer sign-in: alert on a new network, log it, issue the session. */
  async completeSignIn(user: User, remember: boolean, ip: string, how: Record<string, unknown> = {}) {
    await alertIfNewSignIn({ kind: 'customer', id: user.userId, email: user.email, firstName: user.firstName }, ip);
    await logActivity('customer', user.userId, 'auth.login', { rememberMe: remember, twoStep: user.mfaMethod !== 'none', ...how }, ip);
    return { user: this.sanitizeUser(user), token: customerToken(user, remember) };
  }

  /**
   * Sign-up, step 1: check the details, then email a 6-digit code to the address. No account
   * exists yet; the details wait in a signed cookie (email-verification.ts) until the code is
   * typed in, so nobody can open an account on an email address they don't control.
   */
  async startRegistration(input: RegisterInput, ip: string): Promise<{ pendingToken: string; sentTo: string }> {
    await rateLimit(`register:ip:${ip}`, 5, 60 * 60);
    const email = input.email.trim().toLowerCase();
    // Two sign-ups started for the same address an hour can't flood its inbox
    await rateLimit(`register:email:${email}`, 5, 60 * 60);

    const code = newCode();
    const pending = withCode({
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone: input.phone || null,
      passwordHash: await hashPassword(input.password),
    }, code);

    // An address that already has an account gets exactly the same answer on the page ("check
    // your email for a code"), so sign-up can't be used to find out who has an account. The
    // email itself tells the owner they already have one; no code is sent, so the sign-up can
    // never be finished. (Recommended by OWASP's authentication and enumeration guidance.)
    if (await this.emailTaken(email)) {
      const dest = codeDestination(email);
      await sendEmail(accountAlreadyExistsEmail(dest.to, dest.redirectedFor));
      // In the background, so this path does no more waiting than a new sign-up
      inBackground(() => logActivity('system', null, 'auth.register_existing_email', {}, ip));
      return { pendingToken: signPendingRegistration(pending), sentTo: dest.redirectedFor ? 'the shared support inbox (demo address)' : maskEmail(email) };
    }
    return { pendingToken: signPendingRegistration(pending), sentTo: await this.sendVerificationCode(pending, code) };
  }

  /** Sign-up, step 2: the right code creates the account and signs it in. */
  async completeRegistration(pendingToken: string | undefined, code: string, ip: string): Promise<{ user: SanitizedUser; token: string }> {
    const pending = readPendingRegistration(pendingToken);
    // Wrong guesses are counted per email address, wherever they come from
    await rateLimit(`register:verify:${pending.email}`, 5, 15 * 60);
    if (!codeMatches(pending, code)) throw new BadRequestError("That code isn't right. Check the email and try again, or send a new code.");
    // Someone else may have finished signing up with this address in the meantime
    await this.assertEmailFree(pending.email);

    let newUser: User;
    try {
      newUser = await this.usersRepo.createUser({
        firstName: pending.firstName,
        lastName: pending.lastName,
        email: pending.email,
        passwordHash: pending.passwordHash,
        // users.phone is UNIQUE but nullable: store NULL (never '') when no phone was given
        phone: pending.phone || null,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('An account with this email or phone number already exists.');
      }
      throw error;
    }

    await clearFailures(`register:verify:${pending.email}`).catch(() => {});
    await logActivity('customer', newUser.userId, 'auth.register', { email: pending.email, emailVerified: true }, ip);
    await sendEmail(welcomeEmail(newUser.email, newUser.firstName));

    return { user: this.sanitizeUser(newUser), token: customerToken(newUser, true) };
  }

  /** Sign-up, "send a new code": replaces the code (the old one stops working). */
  async resendRegistrationCode(pendingToken: string | undefined): Promise<{ pendingToken: string; sentTo: string }> {
    const pending = readPendingRegistration(pendingToken);
    await rateLimit(`register:resend:${pending.email}`, 3, 15 * 60);
    const code = newCode();
    const fresh = withCode({
      firstName: pending.firstName, lastName: pending.lastName, email: pending.email, phone: pending.phone, passwordHash: pending.passwordHash,
    }, code);
    // Same as the first step: an existing account's owner is told again, never sent a code
    if (await this.emailTaken(pending.email)) {
      const dest = codeDestination(pending.email);
      await sendEmail(accountAlreadyExistsEmail(dest.to, dest.redirectedFor));
      return { pendingToken: signPendingRegistration(fresh), sentTo: dest.redirectedFor ? 'the shared support inbox (demo address)' : maskEmail(pending.email) };
    }
    return { pendingToken: signPendingRegistration(fresh), sentTo: await this.sendVerificationCode(fresh, code) };
  }

  private async sendVerificationCode(p: PendingRegistration, code: string): Promise<string> {
    // Demo @example.com addresses have no inbox: their code goes to the shared support inbox
    const dest = codeDestination(p.email);
    await sendEmail(verifyEmailCodeEmail(dest.to, p.firstName, code, dest.redirectedFor));
    return dest.redirectedFor ? 'the shared support inbox (demo address)' : maskEmail(p.email);
  }

  /**
   * Whether an email already belongs to a customer or a staff member. A staff member's email must
   * not spawn a parallel customer account under their identity (pentest finding M-2); the two
   * tables have separate uniqueness, so both are checked.
   */
  private async emailTaken(email: string): Promise<boolean> {
    // Both lookups every time, so a taken and a free email take the same time
    const [customer, [staff]] = await Promise.all([
      this.usersRepo.findByEmail(email),
      db.select({ id: admin.adminId }).from(admin).where(eq(admin.email, email)),
    ]);
    return !!customer || !!staff;
  }

  private async assertEmailFree(email: string): Promise<void> {
    // Only reached with a correct code, which an already-registered address never receives
    if (await this.emailTaken(email)) {
      throw new ConflictError("We couldn't create an account with that email. If it's yours, try signing in.");
    }
  }

  async getMe(userId: number): Promise<SanitizedUser> {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundError('User does not exist');
    return this.sanitizeUser(user);
  }

  /**
   * Revoke every outstanding token for a customer by bumping token_version, which every
   * authenticated request checks against the database. Used by logout so that signing out
   * actually ends the session rather than only forgetting the cookie.
   */
  async revokeSessions(userId: number): Promise<void> {
    await db.update(users).set({ tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.userId, userId));
  }

  /**
   * "Forgot password?": emails a one-time link. Always answers the same way so the form
   * can't be used to find out which emails have accounts.
   */
  async requestPasswordReset(email: string, ip: string): Promise<void> {
    await rateLimit(`reset:ip:${ip}`, 10, 60 * 60);
    await rateLimit(`reset:email:${email}`, 3, 60 * 60);
    const user = await this.usersRepo.findByEmail(email);
    if (!user || !user.isActive) return;

    const token = randomBytes(32).toString('base64url');
    // Older unused links stop working when a new one is requested
    await db.update(passwordResetTokens).set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.userId), isNull(passwordResetTokens.usedAt)));
    await db.insert(passwordResetTokens).values({
      userId: user.userId,
      tokenHash: sha256(token),
      expiresAt: sql`CURRENT_TIMESTAMP + INTERVAL ${RESET_TOKEN_MINUTES} MINUTE`,
    });
    await logActivity('customer', user.userId, 'auth.password_reset_requested', {}, ip);
    await sendEmail(passwordResetEmail(user.email, user.firstName, token));
  }

  /** Uses a reset link: sets the new password, signs out every device, clears any lockout. */
  async resetPassword(token: string, newPassword: string, ip: string): Promise<void> {
    await rateLimit(`reset-use:ip:${ip}`, 20, 60 * 60);
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, sha256(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, sql`CURRENT_TIMESTAMP`)
      ));
    if (!row) throw new BadRequestError('This reset link is invalid or has expired. Request a new one.');

    const user = await this.usersRepo.findById(row.userId);
    if (!user || !user.isActive) throw new BadRequestError('This reset link is invalid or has expired. Request a new one.');

    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.tokenId, row.tokenId));
    await db.update(users).set({
      passwordHash: await hashPassword(newPassword),
      tokenVersion: sql`${users.tokenVersion} + 1`,
      mustChangePassword: false,
    }).where(eq(users.userId, user.userId));
    // A password reset ends any sign-in lock, both steps (our policy, stated in every lockout email)
    await clearLocks(signInLockKeys('customer', user.userId, user.email));
    // ...and voids any "Lock My Account" link sent before now (account-relock.ts)
    await db.insert(rateLimits).values({ rateKey: relockVoidKey('customer', user.userId), hits: 0, windowStart: sql`CURRENT_TIMESTAMP` })
      .onDuplicateKeyUpdate({ set: { windowStart: sql`CURRENT_TIMESTAMP` } });
    await logActivity('customer', user.userId, 'auth.password_reset', {}, ip);
    await sendEmail(passwordChangedEmail(user.email, user.firstName));
  }

  private sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.userId,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone ?? null,
      role: 'customer',
      mustChangePassword: user.mustChangePassword ?? false,
      created: user.created,
    };
  }
}

/**
 * True when a MySQL/MariaDB insert failed on a UNIQUE index (ER_DUP_ENTRY / errno 1062).
 * Drizzle may wrap the driver error, so the cause chain is checked too.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  let current = error as { code?: string; errno?: number; cause?: unknown } | undefined;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current.code === 'ER_DUP_ENTRY' || current.errno === 1062) return true;
    current = current.cause as typeof current;
  }
  return false;
}
