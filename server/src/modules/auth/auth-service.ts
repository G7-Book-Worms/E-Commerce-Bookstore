import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { passwordResetTokens, users } from '../../../db/schema';
import { UsersRepository } from '../users/users-repository';
import { User } from '../users/users-schema';
import { loginInputSchema, registerInputSchema } from './auth-schema';
import { burnHashTime, comparePassword, hashPassword, needsRehash } from '../../shared/utils/hash-utils';
import { generateToken } from '../../shared/utils/token-util';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors/app-error';
import { assertNotLocked, clearFailures, rateLimit, recordFailure } from '../../shared/security/rate-limit';
import { logActivity } from '../activity/activity-log';
import { sendEmail } from '../email/mailer';
import { passwordChangedEmail, passwordResetEmail, welcomeEmail } from '../email/templates';

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
  async login(input: LoginInput, ip: string): Promise<{ user: SanitizedUser; token: string }> {
    const email = input.email.trim().toLowerCase();
    await rateLimit(`login:ip:${ip}`, 30, 15 * 60);
    const lockKey = `login:email:${email}`;
    await assertNotLocked(lockKey);

    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      await burnHashTime(input.password);
      await recordFailure(lockKey);
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      const locked = await recordFailure(lockKey);
      await logActivity('customer', user.userId, locked ? 'auth.locked_out' : 'auth.login_failed', { email }, ip);
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedError('This account has been deactivated. Contact support@bookwrms.store for help.');
    }

    await clearFailures(lockKey);
    if (needsRehash(user.passwordHash)) {
      await this.usersRepo.updatePasswordHash(user.userId, await hashPassword(input.password));
    }
    await logActivity('customer', user.userId, 'auth.login', { rememberMe: !!input.rememberMe }, ip);

    return { user: this.sanitizeUser(user), token: customerToken(user, !!input.rememberMe) };
  }

  async register(input: RegisterInput, ip: string): Promise<{ user: SanitizedUser; token: string }> {
    await rateLimit(`register:ip:${ip}`, 5, 60 * 60);
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await this.usersRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictError("We couldn't create an account with that email. If it's yours, try signing in.");
    }

    const hashedPassword = await hashPassword(input.password);

    let newUser: User;
    try {
      newUser = await this.usersRepo.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        // users.phone is UNIQUE but nullable: store NULL (never '') when no phone was given
        phone: input.phone || null,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('An account with this email or phone number already exists.');
      }
      throw error;
    }

    await logActivity('customer', newUser.userId, 'auth.register', { email: normalizedEmail }, ip);
    await sendEmail(welcomeEmail(newUser.email, newUser.firstName));

    return { user: this.sanitizeUser(newUser), token: customerToken(newUser, true) };
  }

  async getMe(userId: number): Promise<SanitizedUser> {
    const user = await this.usersRepo.findById(userId);
    if (!user) throw new NotFoundError('User does not exist');
    return this.sanitizeUser(user);
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
    await clearFailures(`login:email:${user.email}`);
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
  let current: any = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current.code === 'ER_DUP_ENTRY' || current.errno === 1062) return true;
    current = current.cause;
  }
  return false;
}
