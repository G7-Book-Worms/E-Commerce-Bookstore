// app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../../server/db';
import { users } from '@/server/src/modules/users/users-schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName } = body;

    // Check for existing user
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingUser) {
      // Return 409 Conflict without setting any auth cookies
      return NextResponse.json(
        {
          status: 'error',
          message: 'An account with this email address already exists.',
        },
        { status: 409 }
      );
    }

    // Proceed with password hashing and insert...
    // const [newUser] = await db.insert(users)...

    return NextResponse.json(
      {
        status: 'success',
        message: 'Account created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Server error' },
      { status: 500 }
    );
  }
}