// Tables live in server/db/schema.ts (the single source of truth for the DB).
import { z } from 'zod';
export { orders, orderItems } from '../../../db/schema';
export type { Order, NewOrder, OrderItem, NewOrderItem } from '../../../db/schema';

// Body for POST /api/orders (placing an order)
export const createOrderInputSchema = z.object({
  shippingAddressId: z.number().int().positive(),
  note: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        bookId: z.number().int().positive(),
        quantity: z.number().int().positive('Quantity must be greater than zero'),
      })
    )
    .min(1, 'At least one item is required to place an order'),
});
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
