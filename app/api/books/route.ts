import { NextRequest } from "next/server";
import { createApiHandler } from "@/server/src/server";
import { HttpResponse } from "@/server/src/shared/http/api-response";
import { parseCatalogQuery, searchBooks } from "@/server/src/modules/books/catalog-repository";

// GET /api/books?section=&genre=&format=&q=&onSale=&inStock=&minPrice=&maxPrice=&minRating=&sort=&page=&pageSize=
// -> { success, data: { books, total, page, pageSize, totalPages } }
export const GET = createApiHandler(async (req: NextRequest) => {
  const query = parseCatalogQuery(req.nextUrl.searchParams);
  return HttpResponse.success(await searchBooks(query));
});
