import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { db } from '../../../db';
import {
  orders,
  orderItems,
  Order,
  NewOrder,
  NewOrderItem,
} from './orders-schema';
import { books } from '../books/books-schema';
import { BadRequestError } from '../../shared/errors/app-error';

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

        // Take the ordered copies out of inventory in the same transaction
        for (const item of itemsData) {
          const [res]: any = await tx
            .update(books)
            .set({ stock: sql`${books.stock} - ${item.quantity}` })
            .where(and(eq(books.bookId, item.bookId), gte(books.stock, item.quantity)));
          // Another order may have bought the last copies since we checked
          if (!res?.affectedRows) {
            throw new BadRequestError('A book in your order just went out of stock');
          }
        }
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