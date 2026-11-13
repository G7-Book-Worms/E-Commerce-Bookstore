// Wrapper for staff portal API routes: signs the request in as staff, checks the role's permission
// (lib/staff-permissions.ts), resolves route params, and turns errors into JSON (createApiHandler).
import { NextRequest, NextResponse } from 'next/server';
import { createApiHandler } from '../../server';
import { authenticateStaff, type StaffSession } from '../../shared/middleware/auth-middleware';
import { clientIp } from '../../shared/security/client-ip';
import { logActivity } from '../activity/activity-log';
import { BadRequestError } from '../../shared/errors/app-error';
import type { Permission } from '../../../../lib/staff-permissions';

export interface StaffContext {
  staff: StaffSession;
  ip: string;
  params: Record<string, string>;
  /** Writes an activity-log entry attributed to this staff member */
  log: (action: string, details?: Record<string, unknown>) => Promise<void>;
}

export function staffApi(
  permission: Permission | null,
  handler: (req: NextRequest, ctx: StaffContext) => Promise<NextResponse>,
  options: { allowPasswordChange?: boolean } = {}
) {
  return createApiHandler(async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    const staff = await authenticateStaff(req, permission, options);
    const ip = clientIp(req);
    const params = (await context?.params) ?? {};
    return handler(req, { staff, ip, params, log: (action, details) => logActivity('admin', staff.id, action, details, ip) });
  });
}

export function idParam(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestError('Invalid id');
  return n;
}
