import { NextRequest } from "next/server";
import { createApiHandler } from "@/server/src/server";
import { HttpResponse } from "@/server/src/shared/http/api-response";
import { BadRequestError, NotFoundError } from "@/server/src/shared/errors/app-error";
import { findCatalogBookByIsbn } from "@/server/src/modules/books/catalog-repository";

// GET /api/books/:isbn -> one book with formats, tags, description and category
export const GET = createApiHandler(
  async (_req: NextRequest, ctx: { params: Promise<{ isbn: string }> }) => {
    const { isbn } = await ctx.params;
    if (!/^\d{10}(\d{3})?$/.test(isbn.replace(/-/g, ""))) {
      throw new BadRequestError("ISBN must be 10 or 13 digits");
    }

    const book = await findCatalogBookByIsbn(isbn);
    if (!book) throw new NotFoundError("Book not found");

    return HttpResponse.success(book);
  }
);
