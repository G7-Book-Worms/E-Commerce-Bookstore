import type { NextRequest } from 'next/server';

/** The visitor's IP. On Vercel the first X-Forwarded-For entry is set by Vercel's edge. */
export function clientIp(req: NextRequest | Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
  return ip.slice(0, 45);
}
