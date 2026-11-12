// app/api/orders/route.ts
// POST /api/orders { shippingAddressId, note? } -> place an order from the logged-in user's cart.
// Prices and stock come from the database (OrdersService); the cart is emptied afterwards.
// Payment is handled separately.
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '../../../server/src/server';
import { authenticateRequest } from '../../../server/src/shared/middleware/auth-middleware';
import { validateBody } from '../../../server/src/shared/middleware/validate-middleware';
import { HttpResponse } from '../../../server/src/shared/http/api-response';
import { BadRequestError, NotFoundError } from '../../../server/src/shared/errors/app-error';
import { CartService } from '../../../server/src/modules/cart/cart-service';
import { OrdersService } from '../../../server/src/modules/orders/orders-service';
import { UsersRepository } from '../../../server/src/modules/users/users-repository';

const placeOrderSchema = z.object({
  shippingAddressId: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

const cartService = new CartService();
const ordersService = new OrdersService();
const usersRepo = new UsersRepository();

export const POST = createApiHandler(async (req: NextRequest) => {
  const { user } = authenticateRequest(req);
  const userId = Number(user.id);
  const { shippingAddressId, note } = await validateBody(req, placeOrderSchema);

  // The address must belong to this user
  const address = await usersRepo.findAddressByIdAndUser(shippingAddressId, userId);
  if (!address) {
    throw new NotFoundError('Shipping address not found');
  }

  const cart = await cartService.getCart(userId);
  if (cart.items.length === 0) {
    throw new BadRequestError('Your cart is empty');
  }

  const order = await ordersService.createOrder(userId, {
    shippingAddressId,
    note,
    items: cart.items.map((i) => ({ bookId: i.bookId, quantity: i.quantity })),
  });

  await cartService.clear(userId);

  const details = await ordersService.getOrderDetails(order.orderId, userId, 'customer');
  return HttpResponse.created(details, 'Order placed successfully');
});
