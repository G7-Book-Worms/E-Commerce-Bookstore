import { env } from './env';

export const databaseConfig = {
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  connectionLimit: 10,
  connectTimeout: 30000,
};