import { z } from 'zod';

/**
 * Registration Input Validation
 * - Name: Minimum 2 characters, trimmed.
 * - Email: Strict email format, normalized to lowercase.
 * - Password Complexity: Minimum 8 characters, at least 1 uppercase letter, 
 *   1 lowercase letter, 1 number, and 1 special symbol.
 */
export const registerInputSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Invalid email address')
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

// Sanitized user profile returned across auth responses
export interface SanitizedUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  createdAt: Date;
}