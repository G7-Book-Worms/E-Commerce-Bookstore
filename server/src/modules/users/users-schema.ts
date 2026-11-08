import { mysqlTable, int, varchar, timestamp, boolean, mysqlEnum, decimal } from 'drizzle-orm/mysql-core';

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

export const addresses = mysqlTable('addresses', {
  addressId: int('address_id').autoincrement().primaryKey().notNull(),
  userId: int('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  street: varchar('street', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  zip: varchar('zip', { length: 20 }).notNull(),
  country: varchar('country', { length: 100 }).notNull(),
  // SCRUM-102: Default address flag
  isDefault: boolean('is_default').default(false).notNull(),
});

export const orders = mysqlTable('orders', {
  orderId: int('order_id').autoincrement().primaryKey().notNull(),
  userId: int('user_id').references(() => users.userId),
  status: mysqlEnum('status', ['pending', 'transit', 'arrived', 'cancelled']).default('pending').notNull(),
  shippingAddressId: int('shipping_address_id').references(() => addresses.addressId).notNull(),
  note: varchar('note', { length: 500 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  priceCents: int('price_cents').notNull(),
  created: timestamp('created').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type Order = typeof orders.$inferSelect;