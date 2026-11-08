import { mysqlTable, varchar, decimal, mysqlEnum, int, timestamp } from 'drizzle-orm/mysql-core';
import { z } from 'zod';
import { users } from '../users/users-schema';
import { books } from '../books/books-schema';

export const orders = mysqlTable('orders', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum('status', ['pending', 'paid', 'shipped', 'delivered', 'cancelled'])
    .default('pending')
    .notNull(),
  shippingAddress: varchar('shipping_address', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable('order_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orderId: varchar('order_id', { length: 36 })
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  bookId: varchar('book_id', { length: 36 })
    .notNull()
    .references(() => books.id),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
});

// Zod DTO for placing an order
export const createOrderInputSchema = z.object({
  shippingAddress: z.string().min(5, 'Shipping address is required'),
  items: z.array(
    z.object({
      bookId: z.string().min(1, 'Book ID is required'),
      quantity: z.number().int().positive('Quantity must be greater than zero'),
    })
  ).min(1, 'At least one item is required to place an order'),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;