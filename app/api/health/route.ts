import { NextResponse } from "next/server";

// GET /api/health -> quick "is the server up?" check
export function GET() {
  return NextResponse.json({ status: "ok" });
}
