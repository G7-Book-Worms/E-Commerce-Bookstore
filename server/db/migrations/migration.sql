-- CREATE SCHEMA IF NOT EXISTS ECommerceDB;
-- USE ECommerceDB
CREATE TABLE IF NOT EXISTS users(
    user_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    password_hash VARCHAR (255) NOT NULL
);
CREATE TABLE IF NOT EXISTS addresses(
    address_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    user_id INT,
    street VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    zip VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,

    CONSTRAINT fk_user_addresses
        FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS book_categories(
    category_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL
);
CREATE TABLE IF NOT EXISTS books(
    book_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    category_id INT,
    isbn VARCHAR(17) NOT NULL,
    author VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_books_category_id
        FOREIGN KEY (category_id) REFERENCES book_categories(category_id)
);
CREATE TABLE IF NOT EXISTS carts(
    cart_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    user_id INT NOT NULL,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT fk_carts_user_id
        FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS cart_items(
    cart_item_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    cart_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT NOT NULL,

    CONSTRAINT fk_cart_items_cart_id
        FOREIGN KEY (cart_id) REFERENCES carts(cart_id) ON DELETE CASCADE,
    CONSTRAINT fk_carts_items_book_id
        FOREIGN KEY (book_id) REFERENCES books(book_id)
);
CREATE TABLE IF NOT EXISTS orders(
    order_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    user_id INT,
    `status` ENUM('pending','transit','arrived','cancelled') NOT NULL DEFAULT 'pending',
    shipping_address_id INT NOT NULL,
    note VARCHAR(500),
    price_cents INT NOT NULL,

    CONSTRAINT fk_order_shipping_address
        FOREIGN KEY (shipping_address_id) REFERENCES addresses(address_id),
    CONSTRAINT fk_order_user_id
        FOREIGN KEY (user_id) REFERENCES users(user_id)
);
CREATE TABLE IF NOT EXISTS order_items(
    order_item_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    order_id INT NOT NULL,
    book_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    unit_total DECIMAL(10,2) AS (quantity * unit_price) STORED,

    CONSTRAINT fk_order_items_order_id
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
    CONSTRAINT fk_order_items_book_id
        FOREIGN KEY (book_id) REFERENCES books(book_id)
);
CREATE TABLE IF NOT EXISTS events(
    event_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    `start_date` DATE NOT NULL,
    end_date DATE NOT NULL,
    promotional_code VARCHAR(8)
);
CREATE TABLE IF NOT EXISTS payments(
    payment_id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    order_id INT NOT NULL,
    card_provider VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    `status` ENUM('pending','processing','completed','failed','cancelled','refunded','chargeback') NOT NULL DEFAULT 'pending',
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_order_id
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
);
CREATE TABLE IF NOT EXISTS `admin`(
    admin_id      INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    first_name    VARCHAR(50)  NOT NULL,
    last_name     VARCHAR(50)  NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    admin_role    ENUM('admin','employee') NOT NULL DEFAULT 'manager',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMP NULL,
    created       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
