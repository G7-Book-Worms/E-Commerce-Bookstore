// pnpm demo:reset — run before the presentation (and after rehearsals).
// 1. Re-applies the catalog seed: stock, prices, sale prices, tags, ratings and discount codes
//    go back to the values in server/db/test-data (undoing rehearsal purchases).
// 2. Gets the demo customer accounts ready: password back to the seeded demo password, account enabled,
//    and the cart emptied, so the live demo starts from an empty cart.
// 3. Demo staff (one per role) get the seeded demo password back, are re-enabled and signed out.
// 4. Sign-in lockouts and rate-limit counters are cleared.
// Orders placed during rehearsals stay (they show up in order history and the staff portal).
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../../index";
import { admin, cartItems, carts, rateLimits, users } from "../../schema";
import { seedCatalog } from "./catalog";

const DATA_DIR = path.resolve(__dirname, "../../test-data");
const load = (file: string) => JSON.parse(readFileSync(path.join(DATA_DIR, `${file}.json`), "utf-8"));

// Accounts used in the demo (all seeded users share the demo password)
const DEMO_EMAILS = ["ada.lovelace@example.com", "alan.turing@example.com"];

async function main() {
  await seedCatalog({ books: load("books"), codes: load("discount_codes"), admins: load("admin") });

  const seeded: { email: string; passwordHash: string }[] = load("users");
  for (const email of DEMO_EMAILS) {
    const seed = seeded.find((u) => u.email === email);
    if (!seed) throw new Error(`${email} is not in test-data/users.json`);
    await db.update(users).set({
      passwordHash: seed.passwordHash,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: sql`${users.tokenVersion} + 1`,
    }).where(eq(users.email, email));
  }

  const staff: { email: string; passwordHash: string }[] = load("admin");
  for (const s of staff) {
    await db.update(admin).set({
      passwordHash: s.passwordHash,
      isActive: true,
      mustChangePassword: false,
      tokenVersion: sql`${admin.tokenVersion} + 1`,
    }).where(eq(admin.email, s.email));
  }
  await db.delete(rateLimits);

  const demoUsers = await db.select({ userId: users.userId }).from(users).where(inArray(users.email, DEMO_EMAILS));
  const demoCarts = demoUsers.length
    ? await db.select({ cartId: carts.cartId }).from(carts).where(inArray(carts.userId, demoUsers.map((u) => u.userId)))
    : [];
  if (demoCarts.length) {
    await db.delete(cartItems).where(inArray(cartItems.cartId, demoCarts.map((c) => c.cartId)));
  }

  console.log(`Demo reset done: catalog restored; ${DEMO_EMAILS.join(", ")} are back to the demo password with empty carts;`);
  console.log(`staff ${staff.map((s) => s.email).join(", ")} are back to the demo password; lockouts cleared.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Demo reset failed:", err);
    process.exit(1);
  });
