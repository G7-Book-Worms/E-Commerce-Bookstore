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
    // Bumped on password change / deactivation / "sign out everywhere": older login tokens stop working
    tokenVersion: int('token_version').default(0).notNull(),
    // Set when staff give the customer a temporary password; cleared when they choose a new one
    mustChangePassword: boolean('must_change_password').default(false).notNull(),
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
    // At or below this many copies the format shows up in the portal's low-stock alerts
    lowStockThreshold: int('low_stock_threshold').default(5).notNull(),
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
    // Real carrier for the tracking number above, so the order page can link to the carrier's
    // own tracking page. Null until staff mark the order shipped.
    carrier: mysqlEnum('carrier', ['ups', 'fedex', 'usps', 'dhl']),
    // Set for guest checkout (SCRUM-208), where there is no user_id to get an address or an
    // email from. Order confirmation and the signed view-order link go here.
    guestEmail: varchar('guest_email', { length: 100 }),
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
    // employee = orders, inventory, messages; manager = + discounts, customers, activity log;
    // admin = + staff accounts (see server/src/modules/staff/permissions.ts)
    // owner outranks admin and can never be managed by anyone; see lib/staff-permissions.ts
    // for who may act on whom. There is exactly one owner.
    adminRole: mysqlEnum('admin_role', ['owner', 'admin', 'employee', 'manager'])
        .default('employee')
        .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    tokenVersion: int('token_version').default(0).notNull(),
    mustChangePassword: boolean('must_change_password').default(false).notNull(),
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
    // Client IP (first X-Forwarded-For hop); null for system actions
    ip: varchar('ip', { length: 45 }),
    created: timestamp('created').defaultNow().notNull(),
}, (t) => [
    index('activity_log_created_idx').on(t.created),
    index('activity_log_action_idx').on(t.action),
]);

// Inventory Movements Table: every stock change (sale, restock, manual adjustment, cancellation)
export const inventoryMovements = mysqlTable('inventory_movements', {
    movementId: int('movement_id').autoincrement().primaryKey().notNull(),
    bookFormatId: int('book_format_id')
        .references(() => bookFormats.bookFormatId, { onDelete: 'cascade' })
        .notNull(),
    // Positive = copies added, negative = copies removed
    quantityChange: int('quantity_change').notNull(),
    stockAfter: int('stock_after').notNull(),
    reason: mysqlEnum('reason', ['sale', 'restock', 'adjustment', 'cancellation']).notNull(),
    note: varchar('note', { length: 255 }),
    orderId: int('order_id').references(() => orders.orderId),
    adminId: int('admin_id').references(() => admin.adminId),
    created: timestamp('created').defaultNow().notNull(),
}, (t) => [
    index('inventory_movements_format_idx').on(t.bookFormatId),
]);

// Contact Messages Table: the footer "Contact Support" form; staff answer from the portal inbox
export const contactMessages = mysqlTable('contact_messages', {
    messageId: int('message_id').autoincrement().primaryKey().notNull(),
    userId: int('user_id').references(() => users.userId),
    name: varchar('name', { length: 100 }).notNull(),
    email: varchar('email', { length: 100 }).notNull(),
    message: text('message').notNull(),
    status: mysqlEnum('status', ['new', 'read', 'replied', 'archived']).default('new').notNull(),
    reply: text('reply'),
    repliedBy: int('replied_by').references(() => admin.adminId),
    repliedAt: timestamp('replied_at'),
    created: timestamp('created').defaultNow().notNull(),
});

// Support Tickets: a conversation with one customer, built from the footer contact form and from
// mail arriving at support@. contact_messages stays as it is for the Session 3 demo; tickets is
// the threaded replacement that the staff inbox reads.
export const tickets = mysqlTable('tickets', {
    ticketId: int('ticket_id').autoincrement().primaryKey().notNull(),
    // Shown to the customer and used to thread replies: "[Ticket #123]" in the subject line.
    number: int('number').notNull().unique(),
    subject: varchar('subject', { length: 200 }).notNull(),
    // Null when the sender has no account; the email address is the only identity we have.
    userId: int('user_id').references(() => users.userId),
    customerName: varchar('customer_name', { length: 100 }).notNull(),
    customerEmail: varchar('customer_email', { length: 100 }).notNull(),
    status: mysqlEnum('status', ['open', 'pending', 'resolved', 'closed']).default('open').notNull(),
    assignedTo: int('assigned_to').references(() => admin.adminId),
    created: timestamp('created').defaultNow().notNull(),
    updated: timestamp('updated').defaultNow().onUpdateNow().notNull(),
}, (t) => [
    index('tickets_status_idx').on(t.status),
    index('tickets_email_idx').on(t.customerEmail),
]);

// One message in a ticket thread, inbound (from the customer) or outbound (a staff reply).
export const ticketMessages = mysqlTable('ticket_messages', {
    ticketMessageId: int('ticket_message_id').autoincrement().primaryKey().notNull(),
    ticketId: int('ticket_id')
        .references(() => tickets.ticketId, { onDelete: 'cascade' })
        .notNull(),
    direction: mysqlEnum('direction', ['in', 'out']).notNull(),
    fromEmail: varchar('from_email', { length: 100 }).notNull(),
    body: text('body').notNull(),
    // RFC 5322 Message-ID of this message and of the one it replies to, so a reply that comes
    // back by email is attached to the right thread instead of opening a new ticket.
    messageId: varchar('message_id', { length: 255 }).unique(),
    inReplyTo: varchar('in_reply_to', { length: 255 }),
    // Which staff member sent it; null for inbound messages.
    staffId: int('staff_id').references(() => admin.adminId),
    created: timestamp('created').defaultNow().notNull(),
}, (t) => [index('ticket_messages_ticket_idx').on(t.ticketId)]);

// Staff Notifications: things the portal should surface that are not customer messages -
// low stock, sold out. Previously these were emailed to support@ only, so they were invisible
// in the portal and looked like a bug.
export const staffNotifications = mysqlTable('staff_notifications', {
    notificationId: int('notification_id').autoincrement().primaryKey().notNull(),
    kind: mysqlEnum('kind', ['low_stock', 'sold_out']).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    // What it refers to, so the UI can link straight to the book or order.
    subjectType: mysqlEnum('subject_type', ['book', 'order']),
    subjectId: int('subject_id'),
    readAt: timestamp('read_at'),
    created: timestamp('created').defaultNow().notNull(),
}, (t) => [index('staff_notifications_read_idx').on(t.readAt)]);

// Password Reset Tokens Table: emailed one-time links. Only a SHA-256 hash of the token is stored.
export const passwordResetTokens = mysqlTable('password_reset_tokens', {
    tokenId: int('token_id').autoincrement().primaryKey().notNull(),
    userId: int('user_id')
        .references(() => users.userId, { onDelete: 'cascade' })
        .notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    created: timestamp('created').defaultNow().notNull(),
});

// Rate Limits Table: counters for sign-in lockout and per-IP limits (kept in the DB so they work
// across serverless instances). key examples: "login:email:ada@example.com", "contact:ip:1.2.3.4"
export const rateLimits = mysqlTable('rate_limits', {
    rateKey: varchar('rate_key', { length: 191 }).primaryKey().notNull(),
    hits: int('hits').default(0).notNull(),
    windowStart: timestamp('window_start').defaultNow().notNull(),
    lockedUntil: timestamp('locked_until'),
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
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;
export type StaffNotification = typeof staffNotifications.$inferSelect;
export type NewStaffNotification = typeof staffNotifications.$inferInsert;
