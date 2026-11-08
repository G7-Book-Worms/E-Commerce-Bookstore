import { eq, desc } from 'drizzle-orm';
import { db } from '../../../db';
import {
  orders,
  orderItems,
  Order,
  NewOrder,
  NewOrderItem,
} from './orders-schema';

export class OrdersRepository {
  async findById(orderId: number): Promise<Order | null> {
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderId, orderId))
      .limit(1);
    return order ?? null;
  }

  async findByUserId(userId: number): Promise<Order[]> {
    return db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.orderId));
  }

  async findItemsByOrderId(orderId: number) {
    return db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  async createOrder(
    orderData: NewOrder,
    itemsData: Omit<NewOrderItem, 'orderItemId' | 'orderId' | 'unitTotal'>[]
  ): Promise<Order> {
    return db.transaction(async (tx) => {
      const [orderResult]: any = await tx.insert(orders).values(orderData);
      const insertedOrderId = orderResult.insertId;

      if (itemsData.length > 0) {
        const preparedItems = itemsData.map((item) => ({
          orderId: insertedOrderId,
          bookId: item.bookId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }));
        await tx.insert(orderItems).values(preparedItems);
      }

      const [created] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderId, insertedOrderId));
      return created;
    });
  }

  async updateStatus(
    orderId: number,
    status: 'pending' | 'transit' | 'arrived' | 'cancelled'
  ): Promise<void> {
    await db
      .update(orders)
      .set({ status })
      .where(eq(orders.orderId, orderId));
  }
}