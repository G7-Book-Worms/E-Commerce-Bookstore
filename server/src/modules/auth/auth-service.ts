import { UsersRepository } from '../users/users-repository';
import { User } from '../users/users-schema';
import { loginInputSchema, registerInputSchema } from './auth-schema';
import { z } from 'zod';
import { comparePassword, hashPassword } from '../../shared/utils/hash-utils';
import { generateToken } from '../../shared/utils/token-util';
import { UnauthorizedError, NotFoundError, ConflictError } from '../../shared/errors/app-error';

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
  created: Date;
}

export class AuthService {
  constructor(private usersRepo = new UsersRepository()) {}

  /**
   * Customer Login
   */
  async login(input: LoginInput): Promise<{ user: SanitizedUser; token: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await this.usersRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateToken({
      id: user.userId,
      email: user.email,
      role: 'customer',
    });

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  /**
   * Customer Registration
   */
  async register(input: RegisterInput): Promise<{ user: SanitizedUser; token: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check collision solely during account creation
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
      // Two requests racing for the same email, or a phone number already in use
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('An account with this email or phone number already exists.');
      }
      throw error;
    }

    const token = generateToken({
      id: newUser.userId,
      email: newUser.email,
      role: 'customer',
    });

    return {
      user: this.sanitizeUser(newUser),
      token,
    };
  }

  /**
   * Session retrieval for /api/auth/me
   */
  async getMe(userId: number): Promise<SanitizedUser> {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User does not exist');
    }
    return this.sanitizeUser(user);
  }

  /**
   * Normalizes database User entity to client Session contract
   */
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
      created: user.created,
    };
  }
}

/**
 * True when a MySQL/MariaDB insert failed on a UNIQUE index (ER_DUP_ENTRY / errno 1062).
 * Drizzle may wrap the driver error, so the cause chain is checked too.
 */
function isDuplicateKeyError(error: unknown): boolean {
  let current: any = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current.code === 'ER_DUP_ENTRY' || current.errno === 1062) return true;
    current = current.cause;
  }
  return false;
}
