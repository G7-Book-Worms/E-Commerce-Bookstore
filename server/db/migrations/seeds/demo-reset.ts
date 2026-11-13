// pnpm demo:reset — run before the presentation (and after rehearsals).
// 1. Re-applies the catalog seed: stock, prices, sale prices, tags, ratings and discount codes
//    go back to the values in server/db/test-data (undoing rehearsal purchases).
// 2. Gets the demo customer accounts ready: password back to BookWorms123!, account enabled,
//    and the cart emptied, so the live demo starts from an empty cart.
// Orders placed during rehearsals stay (they show up in order history and the admin portal).
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../index";
import { cartItems, carts, users } from "../../schema";
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
    await db.update(users).set({ passwordHash: seed.passwordHash, isActive: true }).where(eq(users.email, email));
  }

  const demoUsers = await db.select({ userId: users.userId }).from(users).where(inArray(users.email, DEMO_EMAILS));
  const demoCarts = demoUsers.length
    ? await db.select({ cartId: carts.cartId }).from(carts).where(inArray(carts.userId, demoUsers.map((u) => u.userId)))
    : [];
  if (demoCarts.length) {
    await db.delete(cartItems).where(inArray(cartItems.cartId, demoCarts.map((c) => c.cartId)));
  }

  console.log(`Demo reset done: catalog restored; ${DEMO_EMAILS.join(", ")} have password BookWorms123! and empty carts.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Demo reset failed:", err);
    process.exit(1);
  });
