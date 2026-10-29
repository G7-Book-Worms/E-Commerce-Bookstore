import 'dotenv/config';
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from "mysql2/promise";

async function runMigrations() {
  const connectionUri = process.env.DATABASE_URL;

  if (!connectionUri) {
    throw new Error('DATABASE_URL is not set in your environment file.');
  }

  console.log('Connecting to Aiven MySQL to apply migrations...');

  // NEW: replaces the old createConnection({ uri: ... }) block
  const url = new URL(connectionUri);

  const connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });

  const db = drizzle({ client: connection });

  console.log('Executing pending migrations...');

  await migrate(db, {
    migrationsFolder: './server/db/migrations',
  });

  console.log('Migrations applied successfully!');

  await connection.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});