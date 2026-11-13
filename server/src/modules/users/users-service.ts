import { UsersRepository } from './users-repository';
import {
  UpdateProfileInput,
  ChangePasswordInput,
  CreateAddressInput,
  UpdateAddressInput,
} from './users-validation';
import { comparePassword, hashPassword } from '../../shared/utils/hash-utils';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/app-error';

export class UsersService {
  constructor(private usersRepo = new UsersRepository()) {}

  /**
   * SCRUM-93: Fetch profile without passwordHash
   */
  async getProfile(userId: number) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    return {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      created: user.created,
      updated: user.updated,
    };
  }

  /**
   * SCRUM-94 & SCRUM-95: Update profile with email uniqueness check
   */
  async updateProfile(userId: number, input: UpdateProfileInput) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (input.email && input.email !== user.email) {
      const emailInUse = await this.usersRepo.isEmailTakenByOtherUser(input.email, userId);
      if (emailInUse) {
        throw new BadRequestError('Email address is already associated with another account');
      }
    }

    const updated = await this.usersRepo.updateProfile(userId, input);
    return this.getProfile(userId);
  }

  /**
   * SCRUM-96, SCRUM-97, SCRUM-98: Password change flow
   */
  async changePassword(userId: number, input: ChangePasswordInput) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Re-verify current password against hash
    const isCurrentValid = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password and commit
    const newHash = await hashPassword(input.newPassword);
    await this.usersRepo.updatePasswordHash(userId, newHash);

    return { success: true, message: 'Password updated successfully' };
  }

  /**
   * SCRUM-101 & SCRUM-102: Address CRUD
   */
  async getAddresses(userId: number) {
    return this.usersRepo.getAddressesByUserId(userId);
  }

  async createAddress(userId: number, input: CreateAddressInput) {
    return this.usersRepo.createAddress(userId, input);
  }

  async updateAddress(addressId: number, userId: number, input: UpdateAddressInput) {
    const existing = await this.usersRepo.findAddressByIdAndUser(addressId, userId);
    if (!existing) {
      throw new NotFoundError('Address not found or unauthorized');
    }
    return this.usersRepo.updateAddress(addressId, userId, input);
  }

  async deleteAddress(addressId: number, userId: number) {
    const existing = await this.usersRepo.findAddressByIdAndUser(addressId, userId);
    if (!existing) {
      throw new NotFoundError('Address not found or unauthorized');
    }
    return this.usersRepo.deleteAddress(addressId, userId);
  }

  /**
   * SCRUM-103: Paginated Orders
   */
  async getOrders(userId: number, page: number = 1, limit: number = 10) {
    // Bad or missing query params fall back to sane defaults instead of reaching the DB as NaN
    page = Number.isInteger(page) && page > 0 ? page : 1;
    limit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 10;
    const offset = (page - 1) * limit;
    const { orders: rawOrders, total } = await this.usersRepo.getUserOrdersPaginated(userId, limit, offset);
    const allItems = await this.usersRepo.getOrderItemsForOrders(rawOrders.map((o) => o.orderId));

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      orders: rawOrders.map((o) => {
        const items = allItems.filter((i) => i.orderId === o.orderId);
        return {
          orderId: o.orderId,
          status: o.status,
          note: o.note,
          totalCost: (o.priceCents / 100).toFixed(2), // Convert cents to readable dollars
          priceCents: o.priceCents,
          shippingAddressId: o.shippingAddressId,
          trackingNumber: o.trackingNumber,
          created: o.created,
          totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
          items,
        };
      }),
    };
  }
}