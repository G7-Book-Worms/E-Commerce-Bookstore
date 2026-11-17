// Rules for the recipient name and phone on a shipping address, shared by the forms and the
// server-side schemas so both say the same thing.
import { z } from 'zod';

export const recipientNameSchema = z.string().trim().min(2, 'Enter the name of the person receiving the order').max(100, 'Name is too long');

/** Optional. Digits with the usual separators; 7 to 20 characters. Empty means none. */
export const phoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone number is too long')
  .refine((v) => v === '' || (/^[+()\-.\s\d]{7,20}$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 7), 'Enter a phone number with at least 7 digits')
  .transform((v) => (v === '' ? null : v));

/** "Ada Lovelace · (210) 555-0100" style first line for an address card. */
export function recipientLine(a: { recipientName?: string | null; phone?: string | null }): string | null {
  const parts = [a.recipientName, a.phone].filter((p): p is string => !!p && p.trim() !== '');
  return parts.length ? parts.join(' · ') : null;
}
