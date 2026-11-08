import { count } from 'drizzle-orm';
import { db } from '../../../db';
import { users } from '../users/users-schema';
import { orders } from '../orders/orders-schema';

export class AdminRepository {
  async getSystemCounts() {
    const [userCount] = await db.select({ value: count() }).from(users);
    const [orderCount] = await db.select({ value: count() }).from(orders);

    return {
      totalUsers: userCount?.value ?? 0,
      totalOrders: orderCount?.value ?? 0,
    };
  }
}