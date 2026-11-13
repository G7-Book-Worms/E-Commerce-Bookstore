import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function fixture(name) {
    const path = new URL(`../test-data/${name}.json`, import.meta.url);
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    assert.ok(Array.isArray(rows) && rows.length > 0, `${name} needs seed rows`);
    return rows;
}

function required(row, fields) {
    for (const field of fields.split(' ')) {
        assert.ok(
            typeof row[field] === 'string' && row[field].trim().length > 0,
            `Missing or empty field: ${field}`,
        );
    }
}

function keys(rows, field) {
    return new Set(rows.map(row => row[field]));
}

function unique(rows, field) {
    assert.equal(keys(rows, field).size, rows.length, `Duplicate ${field}`);
}

function refersTo(value, allowed) {
    assert.ok(allowed.has(value), `Unknown seed reference: ${value}`);
}

function positiveQuantity(value) {
    assert.ok(Number.isInteger(value) && value > 0, `Invalid quantity: ${value}`);
}

// Convert decimal prices such as "19.99" to integer cents for exact comparisons.
function cents(value) {
    assert.match(String(value), /^\d+(\.\d{1,2})?$/, `Invalid amount: ${value}`);
    const [whole, fraction = ''] = String(value).split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

const users = fixture('users');
const addresses = fixture('addresses');
const categories = fixture('book_categories');
const books = fixture('books');
const carts = fixture('carts');
const orders = fixture('orders');
const orderItems = fixture('order_items');

const emails = keys(users, 'email');
const isbns = keys(books, 'isbn');
const orderRefs = keys(orders, 'ref');

test('users have required fields and unique emails and phones', () => {
    for (const user of users) {
        required(user, 'firstName lastName email phone passwordHash');
    }
    unique(users, 'email');
    unique(users, 'phone');
});

test('addresses belong to known users and contain shipping details', () => {
    for (const address of addresses) {
        refersTo(address.userEmail, emails);
        required(address, 'street city state zip country');
    }
});

test('book categories have names and unique slugs', () => {
    for (const category of categories) {
        required(category, 'name slug');
    }
    unique(categories, 'slug');
});

test('books have unique ISBNs, valid categories, stock, and prices', () => {
    const slugs = keys(categories, 'slug');
    unique(books, 'isbn');

    for (const book of books) {
        required(book, 'isbn title author description');
        refersTo(book.categorySlug, slugs);
        assert.ok(Number.isInteger(book.stock) && book.stock >= 0, book.title);

        // The sandbox schema defaults an omitted price to zero.
        const price = book.priceCents === undefined ? 0 : book.priceCents;
        assert.ok(Number.isInteger(price) && price >= 0, `Invalid price: ${book.title}`);
    }
});

test('each seeded cart belongs to a known customer', () => {
    // The seed runner uses email to look up a customer's cart.
    unique(carts, 'userEmail');
    for (const cart of carts) {
        refersTo(cart.userEmail, emails);
    }
});

test('cart items reference a cart and a book and have positive quantities', () => {
    const cartOwners = keys(carts, 'userEmail');
    for (const item of fixture('cart_items')) {
        refersTo(item.userEmail, cartOwners);
        refersTo(item.isbn, isbns);
        positiveQuantity(item.quantity);
    }
});

test('orders have a shipping address, valid status, and correct total', () => {
    const addressOwners = keys(addresses, 'userEmail');
    const statuses = new Set(['pending', 'transit', 'arrived', 'cancelled']);
    unique(orders, 'ref');

    for (const order of orders) {
        required(order, 'ref');
        refersTo(order.userEmail, emails);
        refersTo(order.userEmail, addressOwners);
        refersTo(order.status, statuses);

        const lines = orderItems.filter(item => item.orderRef === order.ref);
        assert.ok(lines.length > 0, `${order.ref} has no order items`);

        const totalCents = lines.reduce(
            (sum, item) => sum + item.quantity * cents(item.unitPrice),
            0,
        );
        assert.equal(order.priceCents, totalCents, `Incorrect total for ${order.ref}`);
    }
});

test('order items reference known orders and books and have valid prices', () => {
    for (const item of orderItems) {
        refersTo(item.orderRef, orderRefs);
        refersTo(item.isbn, isbns);
        positiveQuantity(item.quantity);
        cents(item.unitPrice);
    }
});

test('events have valid dates in order and codes within the column limit', () => {
    for (const event of fixture('events')) {
        for (const date of [event.startDate, event.endDate]) {
            assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
            assert.equal(new Date(date).toISOString().slice(0, 10), date);
        }
        assert.ok(event.startDate <= event.endDate, 'Event ends before it starts');
        assert.ok((event.promotionalCode ?? '').length <= 15, 'Promo code too long');
    }
});

test('payments reference known orders and have valid amounts and statuses', () => {
    const statuses = new Set([
        'pending', 'processing', 'completed', 'failed',
        'cancelled', 'refunded', 'chargeback',
    ]);

    for (const payment of fixture('payments')) {
        refersTo(payment.orderRef, orderRefs);
        required(payment, 'cardProvider');
        cents(payment.amount);
        refersTo(payment.status, statuses);
    }
});

test('admin accounts have unique emails and supported roles', () => {
    const admins = fixture('admin');
    const roles = new Set(['admin', 'employee', 'manager']);
    unique(admins, 'email');

    for (const admin of admins) {
        required(admin, 'firstName lastName email passwordHash');
        refersTo(admin.adminRole, roles);
    }
});