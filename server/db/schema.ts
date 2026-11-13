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
  json,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'

// Editions a book can be bought in (cart lines and order lines record which one)
export const BOOK_FORMATS = ['hardcover', 'paperback'] as const;
export type BookFormat = (typeof BOOK_FORMATS)[number];

// Users Table
export const users = mysqlTable('users', {
    userId: int('user_id').autoincrement().primaryKey().notNull(),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    // Nullable: sign-up doesn't ask for a phone. MySQL allows many NULLs in a UNIQUE column.
    phone: varchar('phone', { length: 20 }).unique(),
    email: varchar('email', { length: 100 }).notNull().unique(),
    created: timestamp('created').defaultNow().notNull(),
    updated: timestamp('updated').defaultNow().onUpdateNow().notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    // Admins can disable an account instead of deleting it (SCRUM-200)
    isActive: boolean('is_active').default(true).notNull(),
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
    isDefault: boolean('is_default').default(false).notNull(),
});

// Book Categories Table
export const bookCategories = mysqlTable('book_categories', {
    categoryId: int('category_id').autoincrement().primaryKey().notNull(),
    name: varchar('name', { length: 50 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
});

// Books Table
export const books = mysqlTable('books', {
    bookId: int('book_id').autoincrement().primaryKey().notNull(),
    categoryId: int('category_id').references(() => bookCategories.categoryId),
    isbn: varchar('isbn', { length: 17 }).notNull().unique(),
    author: varchar('author', { length: 100 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    // MySQL 8 only allows a TEXT default written as an expression
    description: text('description').default(sql`('')`).notNull(),
    // Lowest regular format price and total stock across formats.
    // Kept in sync with book_formats (see syncBookTotals) for simple sorting and legacy callers.
    priceCents: int("price_cents").notNull().default(0),
    stock: int('stock').default(0).notNull(),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),
    // Star rating shown on tiles and the product page (demo values; written reviews are out of scope)
    ratingAvg: decimal('rating_avg', { precision: 2, scale: 1 }).default('0.0').notNull(),
    ratingCount: int('rating_count').default(0).notNull(),
});

// Book Tags Table: catalog sections (bestseller, new-release, ...) and genre tags
export const bookTags = mysqlTable('book_tags', {
    bookTagId: int('book_tag_id').autoincrement().primaryKey().notNull(),
    bookId: int('book_id')
        .references(() => books.bookId, { onDelete: 'cascade' })
        .notNull(),
    tag: varchar('tag', { length: 50 }).notNull(),
}, (t) => [
    uniqueIndex('book_tags_book_tag_unique').on(t.bookId, t.tag),
    index('book_tags_tag_idx').on(t.tag),
]);

// Book Formats Table: each edition has its own price, sale price and stock.
// No row (or stock 0) = that format shows as unavailable on the product page.
export const bookFormats = mysqlTable('book_formats', {
    bookFormatId: int('book_format_id').autoincrement().primaryKey().notNull(),
    bookId: int('book_id')
        .references(() => books.bookId, { onDelete: 'cascade' })
        .notNull(),
    format: mysqlEnum('format', BOOK_FORMATS).notNull(),
    priceCents: int('price_cents').notNull(),
    salePriceCents: int('sale_price_cents'),
    stock: int('stock').default(0).notNull(),
}, (t) => [
    uniqueIndex('book_formats_book_format_unique').on(t.bookId, t.format),
]);

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
    format: mysqlEnum('format', BOOK_FORMATS).default('paperback').notNull(),
    quantity: int('quantity').notNull(),
}, (t) => [
    uniqueIndex('cart_items_cart_book_format_unique').on(t.cartId, t.bookId, t.format),
]);

// Discount Codes Table: created by admins, applied in the cart (percent OR fixed amount off)
export const discountCodes = mysqlTable('discount_codes', {
    discountCodeId: int('discount_code_id').autoincrement().primaryKey().notNull(),
    code: varchar('code', { length: 32 }).notNull().unique(),
    percentOff: int('percent_off'),
    amountOffCents: int('amount_off_cents'),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    isActive: boolean('is_active').default(true).notNull(),
    maxUses: int('max_uses'),
    timesUsed: int('times_used').default(0).notNull(),
    created: timestamp('created').defaultNow().notNull(),
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
    trackingNumber: varchar('tracking_number', { length: 100 }),
    // Totals in cents: subtotal - discount + tax = priceCents (the grand total)
    subtotalCents: int('subtotal_cents').default(0).notNull(),
    discountCents: int('discount_cents').default(0).notNull(),
    taxCents: int('tax_cents').default(0).notNull(),
    discountCodeId: int('discount_code_id').references(() => discountCodes.discountCodeId),
    priceCents: int('price_cents').notNull(),
    created: timestamp('created').defaultNow().notNull(),
});

// Order Items Table
export const orderItems = mysqlTable('order_items', {
    orderItemId: int('order_item_id').autoincrement().primaryKey().notNull(),
    orderId: int('order_id').references(() => orders.orderId).notNull(),
    bookId: int('book_id').references(() => books.bookId).notNull(),
    format: mysqlEnum('format', BOOK_FORMATS).default('paperback').notNull(),
    quantity: int('quantity').notNull(),
    // The price actually charged per copy (the sale price when on sale)
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
    promotionalCode: varchar('promotional_code', { length: 15}),
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
    stripeSessionId: varchar('stripe_session_id', { length: 255 }).unique(),
    // From Stripe; never the full card number
    cardBrand: varchar('card_brand', { length: 20 }),
    cardLast4: varchar('card_last4', { length: 4 }),
    created: timestamp('created').defaultNow().notNull(),
});

// Admin Table
export const admin = mysqlTable('admin', {
    adminId: int('admin_id').autoincrement().primaryKey().notNull(),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    email: varchar('email', { length: 100 }).notNull().unique(),
    // Third login factor for staff (SCRUM-187)
    employeeId: varchar('employee_id', { length: 20 }).unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    adminRole: mysqlEnum('admin_role', ['admin', 'employee', 'manager'])
        .default('manager')
        .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastLogin: timestamp('last_login'),
    created: timestamp('created').defaultNow().notNull(),
    updated: timestamp('updated').defaultNow().onUpdateNow().notNull(),
});

// Activity Log Table: who did what, and when (customer or admin actions)
export const activityLog = mysqlTable('activity_log', {
    activityId: int('activity_id').autoincrement().primaryKey().notNull(),
    actorType: mysqlEnum('actor_type', ['customer', 'admin', 'system']).notNull(),
    actorId: int('actor_id'),
    action: varchar('action', { length: 100 }).notNull(),
    details: json('details'),
    created: timestamp('created').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
export type BookCategory = typeof bookCategories.$inferSelect;
export type Book = typeof books.$inferSelect;
export type NewBook = typeof books.$inferInsert;
export type BookTag = typeof bookTags.$inferSelect;
export type BookFormatRow = typeof bookFormats.$inferSelect;
export type NewBookFormatRow = typeof bookFormats.$inferInsert;
export type DiscountCode = typeof discountCodes.$inferSelect;
export type NewDiscountCode = typeof discountCodes.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
export type CartItem = typeof cartItems.$inferSelect;
export type NewCartItem = typeof cartItems.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type Event = typeof events.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Admin = typeof admin.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
