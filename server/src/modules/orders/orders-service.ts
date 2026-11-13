import { OrdersRepository } from './orders-repository';
import { CreateOrderInput } from './orders-schema';
import { BooksRepository } from '../books/books-repository';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../shared/errors/app-error';

export class OrdersService {
  constructor(
    private ordersRepo = new OrdersRepository(),
    private booksRepo = new BooksRepository()
  ) {}

  /** Prices come from the database, never from the client. Totals are in cents. */
  async createOrder(userId: number, input: CreateOrderInput) {
    let totalCents = 0;
    const lineItems = [];

    for (const item of input.items) {
      const book = await this.booksRepo.findById(item.bookId);
      if (!book) {
        throw new NotFoundError(`Book with ID ${item.bookId} not found`);
      }
      if (book.stock < item.quantity) {
        throw new BadRequestError(`Insufficient stock for "${book.title}"`);
      }

      totalCents += book.priceCents * item.quantity;
      lineItems.push({
        bookId: book.bookId,
        quantity: item.quantity,
        // order_items.unit_price is still a DECIMAL in dollars
        unitPrice: (book.priceCents / 100).toFixed(2),
      });
    }

    return this.ordersRepo.createOrder(
      {
        userId,
        shippingAddressId: input.shippingAddressId,
        note: input.note,
        priceCents: totalCents,
        status: 'pending',
      },
      lineItems
    );
  }

  async getUserOrders(userId: number) {
    return this.ordersRepo.findByUserId(userId);
  }

  async getOrderDetails(orderId: number, requestingUserId: number, role: string) {
    const order = await this.ordersRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // Non-admins can only see their own orders
    if (order.userId !== requestingUserId && role !== 'admin') {
      throw new ForbiddenError('You are not authorized to view this order');
    }

    const items = await this.ordersRepo.findItemsByOrderId(orderId);
    return { ...order, items };
  }
}
