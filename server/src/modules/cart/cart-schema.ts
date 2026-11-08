// server/src/modules/cart/cart-schema.ts
import { mysqlTable, int, timestamp } from 'drizzle-orm/mysql-core';
import { users } from '../users/users-schema';
import { books } from '../books/books-schema';

export const carts = mysqlTable('carts', {
  cartId: int('cart_id').autoincrement().primaryKey().notNull(),
  userId: int('user_id')
    .references(() => users.userId)
    .notNull(),
  updated: timestamp('updated').defaultNow().notNull(),
});

export const cartItems = mysqlTable('cart_items', {
  cartItemId: int('cart_item_id').autoincrement().primaryKey().notNull(),
  cartId: int('cart_id')
    .references(() => carts.cartId, { onDelete: 'cascade' })
    .notNull(),
  bookId: int('book_id')
    .references(() => books.bookId)
    .notNull(),
  quantity: int('quantity').notNull(),
});

export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;