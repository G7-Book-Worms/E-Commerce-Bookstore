import { newPasswordSchema } from '../../../../lib/password-policy';
import { z } from 'zod';

// SCRUM-94: Profile update validation
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50).optional(),
  lastName: z.string().min(1, 'Last name is required').max(50).optional(),
  phone: z.string().min(7, 'Invalid phone number format').max(20).optional(),
  email: z.string().email('Invalid email address').max(100).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// SCRUM-96: Password change DTO with confirmation check
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// SCRUM-101 & SCRUM-102: Address DTOs
export const createAddressSchema = z.object({
  street: z.string().min(3).max(100),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  zip: z.string().min(3).max(20),
  country: z.string().min(2).max(100),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;