import { z } from 'zod';
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { bulkIdsSchema, bulkSummary, customerActionNeedsStepUp } from '@/server/src/modules/staff/staff-guards';
import { requireStepUp, stepUpPasswordSchema } from '@/server/src/modules/staff/step-up';
import { bulkCustomerAction } from '@/server/src/modules/users/customers-admin';

const bulkSchema = z.object({
  action: z.enum(['deactivate', 'activate', 'force-reset', 'delete']),
  userIds: bulkIdsSchema,
  actorPassword: stepUpPasswordSchema.optional(),
});

/**
 * POST /api/staff/customers { action, userIds, actorPassword? }
 *
 * Every action offered here is destructive or disables accounts, so the whole route needs
 * customers.manage - an employee with customers.edit cannot reach it at all. The ids are validated
 * as a capped array of positive integers, duplicates are dropped, and each row is then looked up
 * and acted on individually (see bulkCustomerAction); ids that do not exist come back as skipped.
 */
export const POST = staffApi('customers.manage', async (req, { log, staff, ip }) => {
  const { action, userIds, actorPassword } = bulkSchema.parse(await req.json());
  if (customerActionNeedsStepUp(action)) await requireStepUp(staff.id, actorPassword, ip);

  // bulkCustomerAction logs each changed row through this callback; the summary below is the
  // one entry that records what the staff member asked for, including what was skipped.
  const { results } = await bulkCustomerAction(action, userIds, ip, log);
  const summary = bulkSummary(results);
  await log(`customer.bulk_${action.replace('-', '_')}_summary`, {
    requested: userIds.length,
    applied: results.filter((r) => r.ok).map((r) => r.id),
    skipped: results.filter((r) => !r.ok).map((r) => r.id),
  });
  return HttpResponse.success({ results, ...summary }, summary.message);
});
