// Staff management of discount codes (SCRUM-199). Sale prices per format are set on the inventory page.
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { discountCodes } from '../../../db/schema';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { isDuplicateKeyError } from '../auth/auth-service';

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), 'Invalid date');

export const discountInputSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,32}$/, 'Codes are 3-32 letters and numbers'),
    kind: z.enum(['percent', 'amount']),
    value: z.number().positive('Enter a value above zero'),
    startsAt: optionalDate,
    endsAt: optionalDate,
    maxUses: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.kind !== 'percent' || (Number.isInteger(d.value) && d.value <= 90), {
    message: 'Percent off must be a whole number up to 90',
    path: ['value'],
  })
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, { message: 'The end date must be after the start date', path: ['endsAt'] });

export const discountPatchSchema = z.object({ isActive: z.boolean() });

export async function listDiscounts() {
  return db.select().from(discountCodes).orderBy(desc(discountCodes.isActive), desc(discountCodes.created));
}

function toRow(input: z.infer<typeof discountInputSchema>) {
  return {
    code: input.code,
    percentOff: input.kind === 'percent' ? input.value : null,
    amountOffCents: input.kind === 'amount' ? Math.round(input.value * 100) : null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    maxUses: input.maxUses ?? null,
    isActive: input.isActive,
  };
}

export async function createDiscount(input: z.infer<typeof discountInputSchema>) {
  try {
    await db.insert(discountCodes).values(toRow(input));
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ConflictError(`The code ${input.code} already exists`);
    throw err;
  }
}

export async function updateDiscount(id: number, input: z.infer<typeof discountInputSchema>) {
  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.discountCodeId, id));
  if (!row) throw new NotFoundError('Discount code not found');
  try {
    await db.update(discountCodes).set(toRow(input)).where(eq(discountCodes.discountCodeId, id));
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ConflictError(`The code ${input.code} already exists`);
    throw err;
  }
  return row;
}

export async function setDiscountActive(id: number, isActive: boolean) {
  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.discountCodeId, id));
  if (!row) throw new NotFoundError('Discount code not found');
  await db.update(discountCodes).set({ isActive }).where(eq(discountCodes.discountCodeId, id));
  return row;
}
