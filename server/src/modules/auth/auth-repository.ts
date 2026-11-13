import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { users } from '../users/users-schema';

export class AuthRepository {
  async findUserByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }
}