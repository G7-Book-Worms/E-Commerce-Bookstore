import { setAuthCookie } from '../../shared/utils/cookie-utils';
import { NextRequest } from 'next/server';
import { UsersService } from './users-service';
import {
  updateProfileSchema,
  changePasswordSchema,
  createAddressSchema,
  updateAddressSchema,
} from './users-validation';
import { HttpResponse } from '../../shared/http/api-response';
import { HttpStatus } from '../../shared/http/status-codes';

const usersService = new UsersService();

export class UsersController {
  // Helper to get authenticated user ID from request headers (populated by authMiddleware)
  private static getAuthUserId(req: NextRequest): number {
    const userIdHeader = req.headers.get('x-user-id');
    return Number(userIdHeader);
  }

  // GET /api/users/profile
  static async getProfile(req: NextRequest) {
    const userId = UsersController.getAuthUserId(req);
    const profile = await usersService.getProfile(userId);
    return HttpResponse.success(profile, 'Profile retrieved successfully');
  }

  // PATCH /api/users/profile
  static async updateProfile(req: NextRequest) {
    const userId = UsersController.getAuthUserId(req);
    const body = await req.json();
    const validated = updateProfileSchema.parse(body);
    const updated = await usersService.updateProfile(userId, validated);
    return HttpResponse.success(updated, 'Profile updated successfully');
  }

  // POST /api/users/change-password
  static async changePassword(req: NextRequest) {
    const userId = UsersController.getAuthUserId(req);
    const body = await req.json();
    const validated = changePasswordSchema.parse(body);
    const remember = req.headers.get('x-user-remember') === 'true';
    const { token, ...result } = await usersService.changePassword(userId, validated, remember);
    const response = HttpResponse.success(result, 'Password changed successfully');
    // Keep this browser signed in (other devices were signed out); keeps a session cookie a session cookie
    setAuthCookie(response, token, remember);
    return response;
  }

  // GET /api/users/addresses
  static async getAddresses(req: NextRequest) {
    const userId = UsersController.getAuthUserId(req);
    const addresses = await usersService.getAddresses(userId);
    return HttpResponse.success(addresses, 'Addresses retrieved');
  }

  // POST /api/users/addresses
  static async createAddress(req: NextRequest) {
    const userId = UsersController.getAuthUserId(req);
    const body = await req.json();
    const validated = createAddressSchema.parse(body);
    const address = await usersService.createAddress(userId, validated);
    return HttpResponse.success(address, 'Address created', HttpStatus.CREATED);
  }

  // PATCH /api/users/addresses/:id
  static async updateAddress(req: NextRequest, addressId: number) {
    const userId = UsersController.getAuthUserId(req);
    const body = await req.json();
    const validated = updateAddressSchema.parse(body);
    const address = await usersService.updateAddress(addressId, userId, validated);
    return HttpResponse.success(address, 'Address updated');
  }

  // DELETE /api/users/addresses/:id
  static async deleteAddress(req: NextRequest, addressId: number) {
    const userId = UsersController.getAuthUserId(req);
    await usersService.deleteAddress(addressId, userId);
    return HttpResponse.success(null, 'Address removed successfully');
  }

  // GET /api/users/orders
  static async getOrders(req: NextRequest) {
    const userId = UsersController.getAuthUserId(req);
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') || '1');
    const limit = Number(url.searchParams.get('limit') || '10');

    const orders = await usersService.getOrders(userId, page, limit);
    return HttpResponse.success(orders, 'Order history retrieved');
  }
}