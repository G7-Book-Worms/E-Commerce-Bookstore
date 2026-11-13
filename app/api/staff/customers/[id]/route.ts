import { z } from 'zod';
import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { setCustomerActive, setCustomerTemporaryPassword, signOutCustomerEverywhere, updateCustomerDetails } from '@/server/src/modules/users/customers-admin';

const schema = z.object({ action: z.enum(['deactivate', 'activate', 'temp-password', 'sign-out', 'update']) });
const detailsSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Enter a valid email').max(100).toLowerCase(),
  phone: z.string().trim().max(20).nullable().optional().transform((v) => v || null),
});

// PATCH /api/staff/customers/:id { action }
export const PATCH = staffApi('customers.manage', async (req, { params, log }) => {
  const userId = idParam(params.id);
  const body = await req.json();
  const { action } = schema.parse(body);
  if (action === 'update') {
    const result = await updateCustomerDetails(userId, detailsSchema.parse(body));
    await log('customer.updated', { userId, changed: result.changed });
    return HttpResponse.success(result, result.changed.length ? 'Details saved' : 'Nothing changed');
  }
  if (action === 'temp-password') {
    const { password, email } = await setCustomerTemporaryPassword(userId);
    await log('customer.temp_password_set', { userId, email });
    // Shown once to the staff member; never logged or emailed
    return HttpResponse.success({ password }, 'Temporary password set');
  }
  if (action === 'sign-out') {
    const { email } = await signOutCustomerEverywhere(userId);
    await log('customer.signed_out_everywhere', { userId, email });
    return HttpResponse.success({}, 'Signed out of every device');
  }
  const { email } = await setCustomerActive(userId, action === 'activate');
  await log(action === 'activate' ? 'customer.activated' : 'customer.deactivated', { userId, email });
  return HttpResponse.success({}, action === 'activate' ? 'Account reactivated' : 'Account deactivated');
});
