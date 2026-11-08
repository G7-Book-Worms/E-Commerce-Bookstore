import { sql } from 'drizzle-orm';
import {
  mysqlTable,
  int,
  varchar,
  mysqlEnum,
  decimal,
} from 'drizzle-orm/mysql-core';
import { users, addresses } from '../users/users-schema';
import { books } from '../books/books-schema'; // Adjust if in books module

export const orders = mysqlTable('orders', {
  orderId: int('order_id').autoincrement().primaryKey().notNull(),
  userId: int('user_id').references(() => users.userId),
  status: mysqlEnum('status', ['pending', 'transit', 'arrived', 'cancelled'])
    .default('pending')
    .notNull(),
  shippingAddressId: int('shipping_address_id')
    .references(() => addresses.addressId)
    .notNull(),
  note: varchar('note', { length: 500 }),
  priceCents: int('price_cents').notNull(),
});

export const orderItems = mysqlTable('order_items', {
  orderItemId: int('order_item_id').autoincrement().primaryKey().notNull(),
  orderId: int('order_id')
    .references(() => orders.orderId)
    .notNull(),
  bookId: int('book_id')
    .references(() => books.bookId)
    .notNull(),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  unitTotal: decimal('unit_total', { precision: 10, scale: 2 }).generatedAlwaysAs(
    sql`\`quantity\` * \`unit_price\``,
    { mode: 'stored' }
  ),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;