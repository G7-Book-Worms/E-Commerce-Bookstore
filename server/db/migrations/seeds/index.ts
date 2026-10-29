import "dotenv/config";
import { db } from "../../index";
import {
  users, addresses, bookCategories, books,
  carts, cartItems, orders, orderItems, events, payments, admin,
} from "../../schema";

async function seed() {
  // No dependecies tables go first
  const [userRes] = await db.insert(users).values({
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "555-0100",
    email: "ada@example.com",
    passwordHash: "hashed-password",
  });
  const userId = userRes.insertId;

  const [catRes] = await db.insert(bookCategories).values({
    name: "Fiction",
    slug: "fiction",
  });
  const categoryId = catRes.insertId;

  await db.insert(events).values({
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    promotionalCode: "HOLIDAY",
  });

  await db.insert(admin).values({
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
    passwordHash: "hashed-password",
    adminRole: "admin",
  });

  //Depend on users / categories
  const [addrRes] = await db.insert(addresses).values({
    userId,
    street: "1 Main St",
    city: "San Antonio",
    state: "TX",
    zip: "78205",
    country: "USA",
  });
  const addressId = addrRes.insertId;

  const [bookRes] = await db.insert(books).values({
    categoryId,
    isbn: "978-0-00-000000-0",
    author: "Jane Author",
    title: "Sample Book",
    description: "A sample book.",
    stock: 25,
  });
  const bookId = bookRes.insertId;

  const [cartRes] = await db.insert(carts).values({ userId });
  const cartId = cartRes.insertId;

  // Depend on carts / books / addresses
  await db.insert(cartItems).values({ cartId, bookId, quantity: 2 });

  const [orderRes] = await db.insert(orders).values({
    userId,
    shippingAddressId: addressId,
    status: "pending",
    priceCents: 3998,
  });
  const orderId = orderRes.insertId;

  // Depend on orders
  await db.insert(orderItems).values({
    orderId,
    bookId,
    quantity: 2,
    unitPrice: "19.99", // decimal columns take strings
  });

  await db.insert(payments).values({
    orderId,
    cardProvider: "Visa",
    amount: "39.98",
    status: "pending",
  });

  console.log("Seeded successfully");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });

  //once we have actual data we need to do proper api calls, then format data and apply here