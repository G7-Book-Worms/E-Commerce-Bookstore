import { eq, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { discountCodes, type DiscountCode } from '../../../db/schema';
import { BadRequestError } from '../../shared/errors/app-error';

// Looks up a code a shopper typed and checks it can be used right now.
// Throws a 400 with a message the cart can show under the code box.
export async function findUsableDiscount(rawCode: string): Promise<DiscountCode> {
  const code = rawCode.trim().toUpperCase();
  const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, code)).limit(1);
  const now = new Date();
  if (!row || !row.isActive) throw new BadRequestError(`"${code}" isn't a valid discount code`);
  if (row.startsAt && row.startsAt > now) throw new BadRequestError(`"${code}" isn't active yet`);
  if (row.endsAt && row.endsAt < now) throw new BadRequestError(`"${code}" has expired`);
  if (row.maxUses !== null && row.timesUsed >= row.maxUses) {
    throw new BadRequestError(`"${code}" has reached its limit`);
  }
  return row;
}

export async function recordDiscountUse(discountCodeId: number) {
  await db
    .update(discountCodes)
    .set({ timesUsed: sql`${discountCodes.timesUsed} + 1` })
    .where(eq(discountCodes.discountCodeId, discountCodeId));
}

// The code to advertise on the homepage: the active percent-off code with the biggest discount
export async function findFeaturedDiscount(): Promise<DiscountCode | null> {
  const now = new Date();
  const rows = await db.select().from(discountCodes).where(eq(discountCodes.isActive, true));
  const usable = rows.filter(
    (r) =>
      (!r.startsAt || r.startsAt <= now) &&
      (!r.endsAt || r.endsAt >= now) &&
      (r.maxUses === null || r.timesUsed < r.maxUses)
  );
  return usable.sort((a, b) => (b.percentOff ?? 0) - (a.percentOff ?? 0))[0] ?? null;
}
