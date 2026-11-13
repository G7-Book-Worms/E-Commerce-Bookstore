import { z } from 'zod';
import { newPasswordSchema } from '../../../../lib/password-policy';

/**
 * Registration Input Validation
 * - First/last name: required, trimmed, max 50 characters (matches users table).
 * - Email: Strict email format, normalized to lowercase.
 * - Phone: optional. Blank or missing is stored as NULL (users.phone is UNIQUE,
 *   so storing '' would make the second phone-less sign-up fail).
 * - Password: lib/password-policy.ts (10+ characters, upper, lower, number, symbol,
 *   not a common password, at most 72 bytes because bcrypt ignores the rest).
 */
export const registerInputSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters'),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters'),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number cannot exceed 20 characters')
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .max(100, 'Email cannot exceed 100 characters')
    .toLowerCase(),
  // Rules live in lib/password-policy.ts (shared with the sign-up form)
  password: newPasswordSchema,
});

/**
 * Login Input Validation
 */
export const loginInputSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
  // Unchecked = the login cookie ends when the browser closes
  rememberMe: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(100).toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
