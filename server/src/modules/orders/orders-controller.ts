import { NextRequest } from 'next/server';
import { OrdersService } from './orders-service';
import { createOrderInputSchema } from './orders-schema';
import { HttpResponse } from '../../shared/http/api-response';

const ordersService = new OrdersService();

export class OrdersController {
  static async create(req: NextRequest) {
    const userId = req.headers.get('x-user-id') || '';
    const body = await req.json();
    const validated = createOrderInputSchema.parse(body);

    const order = await ordersService.createOrder(userId, validated);
    return HttpResponse.created(order, 'Order placed successfully');
  }

  static async listUserOrders(req: NextRequest) {
    const userId = req.headers.get('x-user-id') || '';
    const orders = await ordersService.getUserOrders(userId);
    return HttpResponse.success(orders);
  }

  static async getById(req: NextRequest, orderId: string) {
    const userId = req.headers.get('x-user-id') || '';
    const role = req.headers.get('x-user-role') || 'customer';

    const order = await ordersService.getOrderDetails(orderId, userId, role);
    return HttpResponse.success(order);
  }
}