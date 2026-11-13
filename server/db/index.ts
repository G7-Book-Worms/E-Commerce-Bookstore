// Shared database connection used by the API routes, seeds and scripts.
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import type { Pool } from "mysql2/promise";

// Aiven requires TLS. Set DB_SSL=false in .env only for a local MySQL without TLS.
// With DB_CA_CERT (Aiven's CA certificate, PEM text) the server's certificate is verified,
// which stops a man-in-the-middle from impersonating the database (SCRUM-193).
// Without it the connection is still encrypted but the certificate isn't checked.
function sslOptions() {
  if (process.env.DB_SSL === "false") return undefined;
  const ca = process.env.DB_CA_CERT?.replace(/\\n/g, "\n");
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}
export const ssl = sslOptions();

// Our Aiven plan allows 76 connections across the whole server. Every Vercel serverless
// instance builds its own pool, and `next dev` builds a fresh one on each hot reload, so
// mysql2's defaults (ten connections, all of them kept idle) exhaust the server quickly:
// idle connections are only reaped after wait_timeout, which is 8 hours on this database.
// A small pool that releases idle connections, reused once per process, is what keeps the
// site from failing with "Too many connections" when more than a few people use it at once.
function createPool() {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 3),
    maxIdle: 1,
    idleTimeout: 30_000,
    // Without keep-alive a pooled connection dies silently when the machine sleeps or
    // switches network, and the next query hangs until it fails with ETIMEDOUT.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    // Fail fast on an unreachable database instead of hanging for ~20 seconds.
    connectTimeout: 10_000,
  });
}

// Reuse one pool per process. Without this, `next dev` leaks a whole pool on every reload.
const globalForDb = globalThis as unknown as { bookwormsPool?: Pool };
const pool = globalForDb.bookwormsPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.bookwormsPool = pool;

export const db = drizzle({ client: pool });
