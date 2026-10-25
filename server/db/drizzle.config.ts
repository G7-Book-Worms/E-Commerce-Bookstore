import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts", // verify this path matches where your schema file lives
  out: "./db/migrations",   // directory where migration files will be placed
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL || ""
  },
  //Restrictions
  verbose: true,
  strict: true,
});