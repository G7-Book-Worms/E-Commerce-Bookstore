import { NextResponse } from "next/server";
import { apiHandler } from "@/server/http";

export const GET = apiHandler(() => NextResponse.json({ status: "ok" }));
