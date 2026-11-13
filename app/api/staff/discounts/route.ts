import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { createDiscount, discountInputSchema } from '@/server/src/modules/discounts/discounts-admin';

// POST /api/staff/discounts
export const POST = staffApi('discounts.manage', async (req, { log }) => {
  const input = discountInputSchema.parse(await req.json());
  await createDiscount(input);
  await log('discount.created', { code: input.code, kind: input.kind, value: input.value });
  return HttpResponse.created({ code: input.code }, `Created ${input.code}`);
});
