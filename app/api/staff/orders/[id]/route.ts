import { z } from 'zod';
import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { ORDER_STATUSES, updateOrderStatus } from '@/server/src/modules/orders/orders-admin';
import { CARRIERS, normalizeTrackingNumber, validateTrackingNumber } from '@/server/src/modules/orders/carriers';

const schema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    carrier: z.enum(CARRIERS).optional().nullable(),
    trackingNumber: z.string().trim().max(100).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  })
  // Reject a bad tracking number here as well as in the service, so the staff member gets
  // the carrier-specific message back as a 400 instead of a generic failure.
  .superRefine((input, ctx) => {
    if (!input.trackingNumber || normalizeTrackingNumber(input.trackingNumber) === '') return;
    const check = validateTrackingNumber(input.carrier, input.trackingNumber);
    if (!check.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trackingNumber'], message: check.error ?? 'Invalid tracking number' });
    }
  });

// PATCH /api/staff/orders/:id { status, carrier?, trackingNumber?, note? }
export const PATCH = staffApi('orders.update', async (req, { params, log, staff }) => {
  const orderId = idParam(params.id);
  const input = schema.parse(await req.json());
  const result = await updateOrderStatus(staff.id, orderId, input);
  await log('order.status_changed', {
    orderId,
    from: result.from,
    to: result.to,
    carrier: input.carrier ?? null,
    trackingNumber: input.trackingNumber ?? null,
  });
  return HttpResponse.success(result, result.emailed ? 'Order updated and the customer was emailed' : 'Order updated');
});
