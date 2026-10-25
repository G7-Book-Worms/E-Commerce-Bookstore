import { sql } from 'drizzle-orm';
import {
  mysqlTable,
  int,
  varchar,
  text,
  timestamp,
  mysqlEnum,
  decimal,
  date,
  boolean,
} from 'drizzle-orm/mysql-core'

// Users Table
export const users = mysqlTable('users', {
    userId: int('user_id').autoincrement().primaryKey().notNull(),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
    email: varchar('email', { length: 100 }).notNull().unique(),
    created: timestamp('created').defaultNow().notNull(),
    updated: timestamp('updated').defaultNow().onUpdateNow().notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
});

// Addresses Table
export const addresses = mysqlTable('addresses', {
    addressId: int('address_id').autoincrement().primaryKey().notNull(),
    userId: int('user_id').references(() => users.userId),
    street: varchar('street', { length: 100 }).notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    state: varchar('state', { length: 100 }).notNull(),
    zip: varchar('zip', { length: 20 }).notNull(),
    country: varchar('country', { length: 100 }).notNull(),
});

// Book Categories Table
export const bookCategories = mysqlTable('book_categories', {
    categoryId: int('category_id').autoincrement().primaryKey().notNull(),
    name: varchar('name', { length: 50 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull(),
});

// Books Table
export const books = mysqlTable('books', {
    bookId: int('book_id').autoincrement().primaryKey().notNull(),
    categoryId: int('category_id').references(() => bookCategories.categoryId),
    isbn: varchar('isbn', { length: 17 }).notNull(),
    author: varchar('author', { length: 100 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    stock: int('stock').default(0).notNull(),
});

// Carts Table
export const carts = mysqlTable('carts', {
    cartId: int('cart_id').autoincrement().primaryKey().notNull(),
    userId: int('user_id').references(() => users.userId).notNull(),
    updated: timestamp('updated').defaultNow().notNull(),
});

// Cart Items Table
export const cartItems = mysqlTable('cart_items', {
    cartItemId: int('cart_item_id').autoincrement().primaryKey().notNull(),
    cartId: int('cart_id')
        .references(() => carts.cartId, { onDelete: 'cascade' })
        .notNull(),
    bookId: int('book_id').references(() => books.bookId).notNull(),
    quantity: int('quantity').notNull(),
});

// Orders Table
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

// Order Items Table
export const orderItems = mysqlTable('order_items', {
    orderItemId: int('order_item_id').autoincrement().primaryKey().notNull(),
    orderId: int('order_id').references(() => orders.orderId).notNull(),
    bookId: int('book_id').references(() => books.bookId).notNull(),
    quantity: int('quantity').notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    unitTotal: decimal('unit_total', { precision: 10, scale: 2 }).generatedAlwaysAs(
        sql`\`quantity\` * \`unit_price\``,
        { mode: 'stored' }
    ),
});

// Events Table
export const events = mysqlTable('events', {
    eventId: int('event_id').autoincrement().primaryKey().notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    promotionalCode: varchar('promotional_code', { length: 8 }),
});

// Payments Table
export const payments = mysqlTable('payments', {
    paymentId: int('payment_id').autoincrement().primaryKey().notNull(),
    orderId: int('order_id').references(() => orders.orderId).notNull(),
    cardProvider: varchar('card_provider', { length: 50 }).notNull(),
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    status: mysqlEnum('status', [
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'refunded',
        'chargeback',
    ])
        .default('pending')
        .notNull(),
    created: timestamp('created').defaultNow().notNull(),
});

// Admin Table
export const admin = mysqlTable('admin', {
    adminId: int('admin_id').autoincrement().primaryKey().notNull(),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    email: varchar('email', { length: 100 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    adminRole: mysqlEnum('admin_role', ['admin', 'employee', 'manager'])
        .default('manager')
        .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastLogin: timestamp('last_login'),
    created: timestamp('created').defaultNow().notNull(),
    updated: timestamp('updated').defaultNow().onUpdateNow().notNull(),
});
/*Removed constraints for the foreign keys in each table */