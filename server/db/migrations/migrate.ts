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

  // Create a dedicated connection with multi-statement support and SSL
  const connection = await mysql.createConnection({
    uri: connectionUri,
    ssl: {
      rejectUnauthorized: false, 
    },
    multipleStatements: true, 
  });

  const db = drizzle(connection as any);

  console.log('Executing pending migrations from ./server/db/migrations...');


  await migrate(db, {
    migrationsFolder: '.server/db/migrations',
  });

  console.log('Migrations applied successfully!');

  await connection.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
/*Running migration: npm run db:migrate */
/*Must have necessary DATABASE_URL Variable */