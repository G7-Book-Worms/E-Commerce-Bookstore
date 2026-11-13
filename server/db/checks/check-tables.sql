USE defaultdb;

-- Each result shows the total rows and how many failed a check.
-- For the seed data, expect row_count > 0 and invalid_rows = 0.

SELECT 'users' AS table_name, COUNT(*) AS row_count,
       COUNT(CASE WHEN TRIM(email) = ''
           OR TRIM(phone) = ''
           OR TRIM(password_hash) = ''
                      THEN 1 END) AS invalid_rows
FROM users

UNION ALL

SELECT 'addresses', COUNT(*),
       COUNT(CASE WHEN TRIM(a.street) = ''
           OR TRIM(a.city) = ''
           OR TRIM(a.zip) = ''
           OR u.user_id IS NULL
                      THEN 1 END)
FROM addresses a
         LEFT JOIN users u ON u.user_id = a.user_id

UNION ALL

SELECT 'book_categories', COUNT(*),
       COUNT(CASE WHEN TRIM(c.name) = ''
           OR TRIM(c.slug) = ''
           OR EXISTS (
               SELECT 1 FROM book_categories other
               WHERE other.slug = c.slug
                 AND other.category_id <> c.category_id
           )
                      THEN 1 END)
FROM book_categories c

UNION ALL

SELECT 'books', COUNT(*),
       COUNT(CASE WHEN TRIM(b.title) = ''
           OR TRIM(b.isbn) = ''
           OR b.stock < 0
           OR b.price_cents < 0
           OR c.category_id IS NULL
           OR EXISTS (
               SELECT 1 FROM books other
               WHERE other.isbn = b.isbn
                 AND other.book_id <> b.book_id
           )
                      THEN 1 END)
FROM books b
         LEFT JOIN book_categories c ON c.category_id = b.category_id

UNION ALL

SELECT 'carts', COUNT(*),
       COUNT(CASE WHEN u.user_id IS NULL THEN 1 END)
FROM carts c
         LEFT JOIN users u ON u.user_id = c.user_id

UNION ALL

SELECT 'cart_items', COUNT(*),
       COUNT(CASE WHEN i.quantity <= 0
           OR c.cart_id IS NULL
           OR b.book_id IS NULL
                      THEN 1 END)
FROM cart_items i
         LEFT JOIN carts c ON c.cart_id = i.cart_id
         LEFT JOIN books b ON b.book_id = i.book_id

UNION ALL

-- Current seed orders use the sum of line items, with no tax or shipping fee.
SELECT 'orders', COUNT(*),
       COUNT(CASE WHEN o.price_cents < 0
           OR o.status NOT IN ('pending', 'transit', 'arrived', 'cancelled')
           OR u.user_id IS NULL
           OR a.address_id IS NULL
           OR totals.order_id IS NULL
           OR o.price_cents <> totals.total_cents
                      THEN 1 END)
FROM orders o
         LEFT JOIN users u ON u.user_id = o.user_id
         LEFT JOIN addresses a ON a.address_id = o.shipping_address_id
    AND a.user_id = o.user_id
         LEFT JOIN (
    SELECT order_id, SUM(unit_total * 100) AS total_cents
    FROM order_items
    GROUP BY order_id
) totals ON totals.order_id = o.order_id

UNION ALL

SELECT 'order_items', COUNT(*),
       COUNT(CASE WHEN i.quantity <= 0
           OR i.unit_price < 0
           OR i.unit_total <> i.quantity * i.unit_price
           OR o.order_id IS NULL
           OR b.book_id IS NULL
                      THEN 1 END)
FROM order_items i
         LEFT JOIN orders o ON o.order_id = i.order_id
         LEFT JOIN books b ON b.book_id = i.book_id

UNION ALL

SELECT 'events', COUNT(*),
       COUNT(CASE WHEN end_date < start_date THEN 1 END)
FROM events

UNION ALL

SELECT 'payments', COUNT(*),
       COUNT(CASE WHEN p.amount < 0
           OR TRIM(p.card_provider) = ''
           OR p.status NOT IN (
                               'pending', 'processing', 'completed', 'failed',
                               'cancelled', 'refunded', 'chargeback'
               )
           OR o.order_id IS NULL
                      THEN 1 END)
FROM payments p
         LEFT JOIN orders o ON o.order_id = p.order_id

UNION ALL

SELECT 'admin', COUNT(*),
       COUNT(CASE WHEN TRIM(email) = ''
           OR TRIM(password_hash) = ''
           OR admin_role NOT IN ('admin', 'employee', 'manager')
           OR is_active NOT IN (0, 1)
                      THEN 1 END)
FROM admin;