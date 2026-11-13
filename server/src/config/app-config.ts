export const AppConfig = {
  name: 'ECommerce Bookstore',
  apiVersion: 'v1',
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
} as const;