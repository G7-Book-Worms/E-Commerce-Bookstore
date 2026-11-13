import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { discountInputSchema, discountPatchSchema, setDiscountActive, updateDiscount } from '@/server/src/modules/discounts/discounts-admin';

// PUT /api/staff/discounts/:id (full edit)
export const PUT = staffApi('discounts.manage', async (req, { params, log }) => {
  const id = idParam(params.id);
  const input = discountInputSchema.parse(await req.json());
  const before = await updateDiscount(id, input);
  await log('discount.updated', { code: input.code, previousCode: before.code });
  return HttpResponse.success({ id }, 'Saved');
});

// PATCH /api/staff/discounts/:id { isActive }
export const PATCH = staffApi('discounts.manage', async (req, { params, log }) => {
  const id = idParam(params.id);
  const { isActive } = discountPatchSchema.parse(await req.json());
  const row = await setDiscountActive(id, isActive);
  await log(isActive ? 'discount.activated' : 'discount.deactivated', { code: row.code });
  return HttpResponse.success({ id, isActive }, isActive ? 'Activated' : 'Deactivated');
});
