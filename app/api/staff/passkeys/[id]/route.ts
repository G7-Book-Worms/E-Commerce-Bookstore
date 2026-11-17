// DELETE /api/staff/passkeys/:id { password } -> removes one of the staff member's own passkeys
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { removeHandler } from '@/server/src/modules/passkeys/passkey-handlers';

export const DELETE = staffApi(null, async (req, { staff, ip, params }) => removeHandler('staff', staff.id, params.id, req, ip));
