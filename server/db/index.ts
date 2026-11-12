// Shared database connection used by the API routes, seeds and scripts.
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// Aiven requires SSL. Set DB_SSL=false in .env for a local MySQL without SSL.
// TODO(SCRUM-61): verify Aiven's CA certificate instead of rejectUnauthorized:false.
const ssl = process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false };

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, ssl });

export const db = drizzle({ client: pool, mode: "default" });
