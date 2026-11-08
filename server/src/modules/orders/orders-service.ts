import crypto from 'crypto';
import { OrdersRepository } from './orders-repository';
import { CreateOrderInput } from './orders-schema';
import { BooksRepository } from '../books/books-repository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/app-error';

export class OrdersService {
  constructor(
    private ordersRepo = new OrdersRepository(),
    private booksRepo = new BooksRepository()
  ) {}

  async createOrder(userId: string, input: CreateOrderInput) {
    let computedTotal = 0;
    const orderId = crypto.randomUUID();
    const lineItemsToInsert = [];

    for (const item of input.items) {
      const book = await this.booksRepo.findById(item.bookId);
      if (!book) {
        throw new NotFoundError(`Book with ID ${item.bookId} not found`);
      }

      if (book.stock < item.quantity) {
        throw new BadRequestError(`Insufficient stock for "${book.title}"`);
      }

      const numericPrice = parseFloat(book.price.toString());
      computedTotal += numericPrice * item.quantity;

      lineItemsToInsert.push({
        id: crypto.randomUUID(),
        orderId,
        bookId: book.id,
        quantity: item.quantity,
        unitPrice: numericPrice.toFixed(2),
      });
    }

    return this.ordersRepo.create(
      {
        id: orderId,
        userId,
        totalAmount: computedTotal.toFixed(2),
        shippingAddress: input.shippingAddress,
        status: 'pending',
      },
      lineItemsToInsert
    );
  }

  async getUserOrders(userId: string) {
    return this.ordersRepo.findByUserId(userId);
  }

  async getOrderDetails(orderId: string, requestingUserId: string, role: string) {
    const order = await this.ordersRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Ensure non-admins only see their own orders
    if (order.userId !== requestingUserId && role !== 'admin') {
      throw new ForbiddenError('You are not authorized to view this order');
    }

    const items = await this.ordersRepo.findItemsByOrderId(orderId);
    return { ...order, items };
  }
}