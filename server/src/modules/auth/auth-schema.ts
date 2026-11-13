import { z } from 'zod';

/**
 * Registration Input Validation
 * - First/last name: required, trimmed, max 50 characters (matches users table).
 * - Email: Strict email format, normalized to lowercase.
 * - Phone: optional. Blank or missing is stored as NULL (users.phone is UNIQUE,
 *   so storing '' would make the second phone-less sign-up fail).
 * - Password Complexity: Minimum 8 characters, at least 1 uppercase letter,
 *   1 lowercase letter, 1 number, and 1 special symbol.
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
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
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
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
