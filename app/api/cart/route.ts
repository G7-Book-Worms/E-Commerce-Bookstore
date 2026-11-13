// app/api/cart/route.ts
// The logged-in user's cart. Every method requires a valid auth_token cookie (401 otherwise).
// Every response's data is the full cart: { cartId, items, totalCount, totals, discount, discountError }.
// GET accepts ?code=XYZ to price the cart with a discount code (8.25% tax is always applied).
import { NextRequest } from 'next/server';
import { createApiHandler } from '../../../server/src/server';
import { authenticateRequest } from '../../../server/src/shared/middleware/auth-middleware';
import { validateBody } from '../../../server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '../../../server/src/shared/http/api-response';
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

// GET /api/cart[?code=BOOKWORMS10] -> the cart with totals
export const GET = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);
  const cart = await cartService.getCart(userId, req.nextUrl.searchParams.get('code'));
  return HttpResponse.success(cart, 'Cart retrieved');
});

// POST /api/cart { bookId, format?, quantity = 1 } -> add a book or increase its quantity
export const POST = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);
  const { bookId, format, quantity = 1 } = await validateBody(req, addToCartSchema);
  const cart = await cartService.addItem(userId, bookId, quantity, format);
  return HttpResponse.success(cart, 'Added to cart');
});

// PATCH /api/cart { bookId, format, quantity } -> set the quantity of a line already in the cart
export const PATCH = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);
  const { bookId, format, quantity } = await validateBody(req, updateCartItemSchema);
  const cart = await cartService.setQuantity(userId, bookId, format, quantity);
  return HttpResponse.success(cart, 'Cart updated');
});

// DELETE /api/cart { bookId, format? } (or ?bookId=123&format=paperback) -> remove a line
// (no format = every format of that book)
export const DELETE = createApiHandler(async (req: NextRequest) => {
  const userId = getUserId(req);
  const q = req.nextUrl.searchParams;
  const { bookId, format } = q.get('bookId') !== null
    ? removeCartItemSchema.parse({ bookId: Number(q.get('bookId')), format: q.get('format') ?? undefined })
    : await validateBody(req, removeCartItemSchema);

  const cart = await cartService.removeItem(userId, bookId, format);
  return HttpResponse.success(cart, 'Item removed from cart');
});
