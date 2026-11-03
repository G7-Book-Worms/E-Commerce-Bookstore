import { NextRequest, NextResponse } from "next/server";
import { AppError, ValidationError } from "./errors";

type Ctx = { params: Promise<Record<string, string | string[]>> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<Response> | Response;

function errorResponse(err: unknown, requestId: string) {
  let appErr: AppError;

  if (err instanceof AppError) appErr = err;
  else {
    console.error(`[${requestId}]`, err);
    appErr = new AppError(500, "Something went wrong");
  }

  return NextResponse.json(
    {
      error: {
        code: appErr.code,
        message: appErr.message,
        details: appErr.details,
        requestId,
      },
    },
    { status: appErr.status, headers: { "x-request-id": requestId } }
  );
}

//Wrap every route handler: any thrown error becomes a consistent JSON response.
export function apiHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

//Read a JSON body; throws a 400 if it isn't valid JSON.
export async function parseJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError({ body: "Body must be valid JSON" });
  }
}

//Small helpers for manual validation.
export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError({ [field]: "Required string" });
  }
  return value.trim();
}

export function requireInt(value: unknown, field: string, min = 1, max = 100): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError({ [field]: `Must be an integer between ${min} and ${max}` });
  }
  return n;
}