import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

// Every setting the server reads, checked once at startup (names match .env.example and Vercel).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_SSL: z.string().default('true'),
  // Aiven's CA certificate (PEM). When set, the database's TLS certificate is verified.
  DB_CA_CERT: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_AUTO_REFUND: z.string().default('true'),
  SITE_URL: z.string().default('http://localhost:3000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('465'),
  NOREPLY_EMAIL: z.string().optional(),
  NOREPLY_EMAIL_PASSWORD: z.string().optional(),
  SUPPORT_EMAIL: z.string().optional(),
  SUPPORT_EMAIL_PASSWORD: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  throw new Error('Missing or invalid environment configuration');
}

export const env = parsedEnv.data;
