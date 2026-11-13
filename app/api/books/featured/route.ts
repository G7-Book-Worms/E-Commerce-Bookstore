// app/api/books/featured/route.ts
import { NextResponse } from 'next/server';
import { BooksService } from '../../../../server/src/modules/books/books-service';

export async function GET() {
  try {
    const booksService = new BooksService();
    const feed = await booksService.getHomepageFeed();
    return NextResponse.json({ status: 'success', data: feed });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: error.message || 'Failed to fetch homepage feeds' },
      { status: 500 }
    );
  }
}