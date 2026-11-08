// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  email: z.string().email('Valid email is required'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = contactSchema.parse(body);

    // In production, dispatch email via Resend, Sendgrid, or persist to an inquiries table
    console.log('[Storefront Inquiry Received]:', validated);

    return NextResponse.json({
      status: 'success',
      message: 'Thank you for contacting Book Worms! Our librarians will respond shortly.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.errors?.[0]?.message || 'Invalid inquiry submission' },
      { status: 400 }
    );
  }
}