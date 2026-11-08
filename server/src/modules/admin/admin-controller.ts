import { NextRequest } from 'next/server';
import { AdminService } from './admin-service';
import { HttpResponse } from '../../shared/http/api-response';

const adminService = new AdminService();

export class AdminController {
  /**
   * Retrieves high-level administrative metrics (user count, order count, etc.)
   */
  static async overview(req: NextRequest) {
    const stats = await adminService.getOverview();
    return HttpResponse.success(stats, 'Admin dashboard overview retrieved successfully');
  }
}