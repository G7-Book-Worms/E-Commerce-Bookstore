// Shared database connection used by the API routes, seeds and scripts.
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

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

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, ssl });

export const db = drizzle({ client: pool });
