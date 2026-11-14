import { z } from 'zod';
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { BULK_LIMIT, ORDER_STATUSES, bulkUpdateOrderStatus } from '@/server/src/modules/orders/orders-admin';

// Order ids come from checkboxes in the browser, so they are validated like any other input:
// positive integers, no duplicates allowed through unchecked, and a hard cap on the batch.
const schema = z.object({
  orderIds: z.array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).min(1).max(BULK_LIMIT),
  status: z.enum(ORDER_STATUSES),
});

// PATCH /api/staff/orders/bulk { orderIds: number[], status }
// Marks several orders shipped / delivered / cancelled in one go. Each order is still put
// through the same transition rules and side effects as a single update.
export const PATCH = staffApi('orders.update', async (req, { log, staff }) => {
  const { orderIds, status } = schema.parse(await req.json());
  const result = await bulkUpdateOrderStatus(staff.id, orderIds, status);
  await log('order.bulk_status_changed', {
    status,
    requested: orderIds.length,
    updated: result.updated,
    skipped: result.skipped.length,
  });

  const message =
    result.updated.length === 0
      ? 'No orders could be changed'
      : `${result.updated.length} order${result.updated.length === 1 ? '' : 's'} updated` +
        (result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : '');
  return HttpResponse.success(result, message);
});
