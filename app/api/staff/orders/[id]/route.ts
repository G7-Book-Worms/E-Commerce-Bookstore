import { z } from 'zod';
import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { ORDER_STATUSES, updateOrderStatus } from '@/server/src/modules/orders/orders-admin';

const schema = z.object({
  status: z.enum(ORDER_STATUSES),
  trackingNumber: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

// PATCH /api/staff/orders/:id { status, trackingNumber?, note? }
export const PATCH = staffApi('orders.update', async (req, { params, log, staff }) => {
  const orderId = idParam(params.id);
  const input = schema.parse(await req.json());
  const result = await updateOrderStatus(staff.id, orderId, input);
  await log('order.status_changed', { orderId, from: result.from, to: result.to, trackingNumber: input.trackingNumber ?? null });
  return HttpResponse.success(result, result.emailed ? 'Order updated and the customer was emailed' : 'Order updated');
});
