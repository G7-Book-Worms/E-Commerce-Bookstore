// app/api/cart/route.ts
// The logged-in user's cart. Every method requires a valid auth_token cookie (401 otherwise).
// Every response's data is the full cart: { cartId, items, totalCount, subtotalCents }.
import { NextRequest } from 'next/server';
import { createApiHandler } from '../../../server/src/server';
import { authenticateRequest } from '../../../server/src/shared/middleware/auth-middleware';
import { validateBody } from '../../../server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '../../../server/src/shared/http/api-response';
import { BadRequestError } from '../../../server/src/shared/errors/app-error';
import {
  CartService,
  addToCartSchema,
  updateCartItemSchema,
  removeCartItemSchema,
} from '../../../server/src/modules/cart/cart-service';

const cartService = new CartService();

function getUserId(req: NextRequest): number {
  const { user } = authenticateRequest(req);
  return Number(user.id);
}

// GET /api/cart -> list the cart
export const GET = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);
  const cart = await cartService.getCart(userId);
  return HttpResponse.success(cart, 'Cart retrieved');
});

// POST /api/cart { bookId, quantity = 1 } -> add a book or increase its quantity
export const POST = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);
  // validateBody is typed by the schema input, so restate the default for TypeScript
  const { bookId, quantity = 1 } = await validateBody(req, addToCartSchema);
  const cart = await cartService.addItem(userId, bookId, quantity);
  return HttpResponse.success(cart, 'Added to cart');
});

// PATCH /api/cart { bookId, quantity } -> set the quantity of a book already in the cart
export const PATCH = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);
  const { bookId, quantity } = await validateBody(req, updateCartItemSchema);
  const cart = await cartService.setQuantity(userId, bookId, quantity);
  return HttpResponse.success(cart, 'Cart updated');
});

// DELETE /api/cart { bookId }  (or /api/cart?bookId=123) -> remove a book from the cart
export const DELETE = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);

  const fromQuery = req.nextUrl.searchParams.get('bookId');
  let bookId: number;
  if (fromQuery !== null) {
    const parsed = removeCartItemSchema.safeParse({ bookId: Number(fromQuery) });
    if (!parsed.success) throw new BadRequestError('Validation failed', parsed.error.errors);
    bookId = parsed.data.bookId;
  } else {
    ({ bookId } = await validateBody(req, removeCartItemSchema));
  }

  const cart = await cartService.removeItem(userId, bookId);
  return HttpResponse.success(cart, 'Item removed from cart');
});
