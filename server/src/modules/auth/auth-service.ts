import { UsersRepository } from '../users/users-repository';
import { User } from '../users/users-schema';
import { loginInputSchema, registerInputSchema } from './auth-schema';
import { z } from 'zod';
import { comparePassword, hashPassword } from '../../shared/utils/hash-utils';
import { generateToken } from '../../shared/utils/token-util';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../../shared/errors/app-error';

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;

export interface SanitizedUser {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
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
      throw new BadRequestError('An account with this email already exists. Please sign in instead.');
    }

    // Parse single 'name' field from RegisterInput into firstName and lastName
    const nameParts = input.name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Member';
    const lastName = nameParts.slice(1).join(' ') || '';

    const hashedPassword = await hashPassword(input.password);

    const newUser = await this.usersRepo.createUser({
      firstName,
      lastName,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      phone: '',
    });

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
      phone: user.phone || '',
      role: 'customer',
      created: user.created,
    };
  }
}