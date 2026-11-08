import { NextResponse } from "next/server";
import { apiHandler } from "@/server/http";
import { NotFoundError, ValidationError } from "@/server/errors";
import { books } from "@/lib/sample-books"; // adjust to actual export name

export const GET = apiHandler(async (_req, ctx) => {
  const { isbn } = (await ctx.params) as { isbn: string };

  if (!/^\d{10}(\d{3})?$/.test(isbn)) {
    throw new ValidationError({ isbn: "Must be a 10 or 13 digit ISBN" });
  }

  const book = books.find((b) => b.isbn === isbn);
  if (!book) throw new NotFoundError("Book");

  return NextResponse.json(book);
});
