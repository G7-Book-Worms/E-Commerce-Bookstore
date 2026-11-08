import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../../index";
import {
  users, addresses, bookCategories, books,
  carts, cartItems, orders, orderItems, events, payments, admin,
} from "../../schema";

const DATA_DIR = path.resolve(__dirname, "../../test-data");

function load<T = any>(file: string): T[] {
  return JSON.parse(readFileSync(path.join(DATA_DIR, `${file}.json`), "utf-8"));
}

// Multi-row INSERT returns the first generated id; the rest are consecutive.
// Returns a Map of natural key -> generated id.
function idMap<T>(rows: T[], firstId: number, key: (row: T) => string) {
  const map = new Map<string, number>();
  rows.forEach((row, i) => map.set(key(row), firstId + i));
  return map;
}

// Look up a foreign key by natural key, failing loudly on a typo in the data files.
function ref(map: Map<string, number>, key: string, what: string): number {
  const id = map.get(key);
  if (id === undefined) throw new Error(`Seed data error: no ${what} "${key}"`);
  return id;
}

async function seed() {
  // ---------- No-dependency tables ----------
  const userRows = load("users");
  const [userRes] = await db.insert(users).values(userRows);
  const userIds = idMap(userRows, userRes.insertId, (u) => u.email);

  const categoryRows = load("book_categories");
  const [catRes] = await db.insert(bookCategories).values(categoryRows);
  const categoryIds = idMap(categoryRows, catRes.insertId, (c) => c.slug);

  await db.insert(events).values(load("events"));
  await db.insert(admin).values(load("admin"));

  // ---------- Depend on users / categories ----------
  const addressRows = load("addresses");
  const [addrRes] = await db.insert(addresses).values(
    addressRows.map(({ userEmail, ...a }) => ({
      ...a,
      userId: ref(userIds, userEmail, "user"),
    }))
  );
  // A user's shipping address = their first address in the file
  const addressIds = new Map<string, number>();
  addressRows.forEach((a, i) => {
    if (!addressIds.has(a.userEmail)) addressIds.set(a.userEmail, addrRes.insertId + i);
  });

  const bookRows = load("books");
  const [bookRes] = await db.insert(books).values(
    bookRows.map(({ categorySlug, ...b }) => ({
      ...b,
      categoryId: ref(categoryIds, categorySlug, "category"),
    }))
  );
  const bookIds = idMap(bookRows, bookRes.insertId, (b) => b.isbn);

  const cartRows = load("carts");
  const [cartRes] = await db.insert(carts).values(
    cartRows.map(({ userEmail }) => ({ userId: ref(userIds, userEmail, "user") }))
  );
  const cartIds = idMap(cartRows, cartRes.insertId, (c) => c.userEmail);

  // ---------- Depend on carts / books / addresses ----------
  await db.insert(cartItems).values(
    load("cart_items").map((ci) => ({
      cartId: ref(cartIds, ci.userEmail, "cart"),
      bookId: ref(bookIds, ci.isbn, "book"),
      quantity: ci.quantity,
    }))
  );

  const orderRows = load("orders");
  const [orderRes] = await db.insert(orders).values(
    orderRows.map(({ ref: _ref, userEmail, ...o }) => ({
      ...o,
      userId: ref(userIds, userEmail, "user"),
      shippingAddressId: ref(addressIds, userEmail, "address"),
    }))
  );
  const orderIds = idMap(orderRows, orderRes.insertId, (o) => o.ref);

  // ---------- Depend on orders ----------
  await db.insert(orderItems).values(
    load("order_items").map(({ orderRef, isbn, ...oi }) => ({
      ...oi,
      orderId: ref(orderIds, orderRef, "order"),
      bookId: ref(bookIds, isbn, "book"),
    }))
  );

  await db.insert(payments).values(
    load("payments").map(({ orderRef, ...p }) => ({
      ...p,
      orderId: ref(orderIds, orderRef, "order"),
    }))
  );

  console.log("Seeded successfully");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
