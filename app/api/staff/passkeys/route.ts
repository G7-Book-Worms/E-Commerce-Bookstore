// GET  /api/staff/passkeys -> the signed-in staff member's passkeys
// POST /api/staff/passkeys { step: 'options' | 'add', ... } -> add one (see /api/passkeys)
import { staffApi } from '@/server/src/modules/staff/staff-api';
import { addHandler, listHandler } from '@/server/src/modules/passkeys/passkey-handlers';

export const GET = staffApi(null, async (_req, { staff }) => listHandler('staff', staff.id));
export const POST = staffApi(null, async (req, { staff, ip }) => addHandler('staff', staff.id, req, ip));
