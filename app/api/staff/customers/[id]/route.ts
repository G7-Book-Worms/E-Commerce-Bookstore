import { z } from 'zod';
import { staffApi, idParam } from '@/server/src/modules/staff/staff-api';
import { HttpResponse } from '@/server/src/shared/http/api-response';
import { ForbiddenError } from '@/server/src/shared/errors/app-error';
import { can } from '@/lib/staff-permissions';
import {
  CUSTOMER_ACTIONS,
  customerActionNeedsManage,
  customerActionNeedsStepUp,
} from '@/server/src/modules/staff/staff-guards';
import { requireStepUp, stepUpPasswordSchema } from '@/server/src/modules/staff/step-up';
import {
  anonymiseCustomer,
  forceCustomerPasswordReset,
  sendCustomerResetLink,
  setCustomerActive,
  setCustomerTemporaryPassword,
  signOutCustomerEverywhere,
  unusablePasswordHash,
  updateCustomerDetails,
} from '@/server/src/modules/users/customers-admin';

const schema = z.object({
  action: z.enum(CUSTOMER_ACTIONS),
  actorPassword: stepUpPasswordSchema.optional(),
});
const detailsSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50),
  lastName: z.string().trim().min(1, 'Last name is required').max(50),
  email: z.string().trim().email('Enter a valid email').max(100).toLowerCase(),
  phone: z.string().trim().max(20).nullable().optional().transform((v) => v || null),
});

/**
 * PATCH /api/staff/customers/:id { action, ... }
 *
 * The wrapper only gets the staff member through the door (customers.view). Which actions they may
 * take is decided here, per action, from the role the wrapper re-read from the database:
 *   - customers.edit  (employees and up): correct contact details, send a password reset link;
 *   - customers.manage (managers and up): everything that disables, resets or scrubs an account,
 *     and those also re-confirm the staff member's own password.
 */
export const PATCH = staffApi('customers.view', async (req, { params, log, staff, ip }) => {
  const userId = idParam(params.id);
  const body = await req.json();
  const { action, actorPassword } = schema.parse(body);

  if (customerActionNeedsManage(action)) {
    if (!can(staff.role, 'customers.manage')) throw new ForbiddenError('Your role cannot do that to a customer account');
  } else if (!can(staff.role, 'customers.edit')) {
    throw new ForbiddenError('Your role cannot change customer details');
  }
  if (customerActionNeedsStepUp(action)) await requireStepUp(staff.id, actorPassword, ip);

  switch (action) {
    case 'update': {
      const result = await updateCustomerDetails(userId, detailsSchema.parse(body));
      await log('customer.updated', { userId, changed: result.changed });
      return HttpResponse.success(result, result.changed.length ? 'Details saved' : 'Nothing changed');
    }
    case 'send-reset-link': {
      const { email } = await sendCustomerResetLink(userId, ip);
      await log('customer.reset_link_sent', { userId, email });
      return HttpResponse.success({}, 'Password reset link sent to the customer');
    }
    case 'force-reset': {
      const { email, emailSent } = await forceCustomerPasswordReset(userId, ip);
      await log('customer.password_reset_forced', { userId, email, emailSent });
      return HttpResponse.success(
        {},
        emailSent
          ? 'Signed out everywhere; they must set a new password and a reset link is on its way'
          : 'Signed out everywhere; they must set a new password. The reset email could not be sent - ask them to use "Forgot password?"',
      );
    }
    case 'temp-password': {
      const { password, email } = await setCustomerTemporaryPassword(userId);
      await log('customer.temp_password_set', { userId, email });
      // Shown once to the staff member; never logged or emailed
      return HttpResponse.success({ password }, 'Temporary password set');
    }
    case 'sign-out': {
      const { email } = await signOutCustomerEverywhere(userId);
      await log('customer.signed_out_everywhere', { userId, email });
      return HttpResponse.success({}, 'Signed out of every device');
    }
    case 'delete': {
      const { email } = await anonymiseCustomer(userId, await unusablePasswordHash());
      // The previous email is recorded so the deletion can be traced; the row no longer holds it.
      await log('customer.anonymised', { userId, previousEmail: email });
      return HttpResponse.success({}, 'Account deleted: personal details removed, orders kept');
    }
    default: {
      const { email } = await setCustomerActive(userId, action === 'activate');
      await log(action === 'activate' ? 'customer.activated' : 'customer.deactivated', { userId, email });
      return HttpResponse.success({}, action === 'activate' ? 'Account reactivated' : 'Account deactivated');
    }
  }
});
