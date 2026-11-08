import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/server/src/shared/middleware/auth-middleware';
import { UsersRepository } from '@/server/src/modules/users/users-repository';

const usersRepo = new UsersRepository();

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate user from JWT cookie
    const { headers } = authenticateRequest(req);
    const userId = Number(headers.get('x-user-id'));

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit')) || 10));
    const offset = (page - 1) * limit;

    // 3. Fetch paginated orders from repository
    const result = await usersRepo.getUserOrdersPaginated(userId, limit, offset);

    return NextResponse.json({
      status: 'success',
      data: {
        orders: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to retrieve orders',
      },
      { status: error.statusCode || 500 }
    );
  }
}