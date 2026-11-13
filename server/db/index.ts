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

// Our Aiven plan allows 76 connections across the whole server, and mysql2 defaults to a
// pool of ten that it keeps idle. Every Vercel serverless instance builds its own pool, and
// a frozen instance cannot run timers, so its idle connections are not reaped by mysql2 at
// all - they sit until the instance is recycled or the server's wait_timeout expires, which
// is 8 hours here. One production instance was observed holding all ten for six minutes with
// no traffic. Capping the pool is therefore the part that matters in production; `next dev`
// compounds it differently, by building a fresh pool on every hot reload unless one is
// reused per process. Together these keep the site from failing with "Too many connections".
function createPool() {
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    ssl,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 3),
    // maxIdle + idleTimeout are what stop a dead connection being handed to a request.
    // When a machine sleeps or changes network its connections are silently dropped: the
    // sockets look fine locally, so mysql2 keeps them pooled and reuses them, and the next
    // query writes into a black hole. Measured against a severed connection, the defaults
    // reused one that had been idle 40s and the query never returned; discarding idle
    // connections after 30s instead means a fresh one is opened and the attempt fails in
    // connectTimeout. This is also what keeps the pool small between bursts.
    maxIdle: 1,
    idleTimeout: 30_000,
    // Keep-alive is prevention, not detection: the probes keep the connection present in
    // NAT and firewall tables so it is less likely to be dropped while idle. It is not a
    // way to notice a connection that has already died - with this server's kernel settings
    // TCP would need about 11 minutes (a 10s idle delay, then 9 probes 75s apart) to give up.
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    // Bounds the replacement attempt when the database is unreachable: 10s and a clear
    // ETIMEDOUT, rather than a request that hangs indefinitely.
    connectTimeout: 10_000,
  });
}

// Reuse one pool per process. Without this, `next dev` leaks a whole pool on every reload.
const globalForDb = globalThis as unknown as { bookwormsPool?: Pool };
const pool = globalForDb.bookwormsPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.bookwormsPool = pool;

export const db = drizzle({ client: pool });
