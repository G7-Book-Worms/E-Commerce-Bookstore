// Checkout with Stripe (SCRUM-184/185/186).
// 1. start(): price the cart on the server, save the order as "awaiting payment",
//    and create a Stripe Checkout session for exactly that total.
// 2. The shopper pays on Stripe's page (test card 4242 4242 4242 4242).
// 3. complete(): Stripe sends them back with the session id; we ask Stripe whether it was
//    paid, then take the books out of stock, mark the payment completed and empty the cart.
import { and, eq, gte, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '../../../db';
import { bookFormats, cartItems, carts, orderItems, orders, payments, users } from '../../../db/schema';
import { CartService } from '../cart/cart-service';
import { UsersRepository } from '../users/users-repository';
import { recordDiscountUse } from '../discounts/discounts-repository';
import { syncBookTotals } from '../books/book-totals';
import { getStripe, autoRefundEnabled } from '../payments/stripe';
import { logActivity } from '../activity/activity-log';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';

const cartService = new CartService();
const usersRepo = new UsersRepository();
const dollars = (cents: number) => (cents / 100).toFixed(2);
const FORMAT_LABEL = { hardcover: 'Hardcover', paperback: 'Paperback' } as const;

type StartInput = { shippingAddressId: number; discountCode?: string; note?: string };

export async function startCheckout(userId: number, email: string, input: StartInput, origin: string) {
  const stripe = getStripe(); // fail before saving anything if payments aren't configured

  const address = await usersRepo.findAddressByIdAndUser(input.shippingAddressId, userId);
  if (!address) throw new NotFoundError('Shipping address not found');

  const cart = await cartService.getCart(userId, input.discountCode);
  if (cart.items.length === 0) throw new BadRequestError('Your cart is empty');
  if (input.discountCode && cart.discountError) throw new BadRequestError(cart.discountError);
  for (const line of cart.items) {
    if (line.quantity > line.stock) {
      throw new BadRequestError(
        line.stock === 0
          ? `The ${line.format} of "${line.title}" just sold out. Remove it to continue.`
          : `Only ${line.stock} ${line.format} copies of "${line.title}" are left. Lower the quantity to continue.`
      );
    }
  }
  const { totals } = cart;
  if (totals.totalCents < 50) throw new BadRequestError('Orders must be at least $0.50 to pay by card');

  // Save the order first so the Stripe session can point at it
  const orderId = await db.transaction(async (tx) => {
    const [res] = (await tx.insert(orders).values({
      userId,
      status: 'pending',
      shippingAddressId: address.addressId,
      note: input.note,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      discountCodeId: cart.discount?.discountCodeId ?? null,
      priceCents: totals.totalCents,
    })) as unknown as [{ insertId: number }];
    await tx.insert(orderItems).values(
      cart.items.map((l) => ({
        orderId: res.insertId,
        bookId: l.bookId,
        format: l.format,
        quantity: l.quantity,
        unitPrice: dollars(l.unitPriceCents), // the price charged (sale price when on sale)
      }))
    );
    await tx.insert(payments).values({
      orderId: res.insertId,
      cardProvider: 'stripe',
      amount: dollars(totals.totalCents),
      status: 'pending',
    });
    return res.insertId;
  });

  // Stripe can't take a negative line, so the code becomes a one-time coupon for the exact amount
  let couponId: string | undefined;
  if (totals.discountCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: totals.discountCents,
      currency: 'usd',
      duration: 'once',
      name: `${cart.discount?.code} (${cart.discount?.label})`,
    });
    couponId = coupon.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    client_reference_id: String(orderId),
    metadata: { orderId: String(orderId), userId: String(userId) },
    line_items: [
      ...cart.items.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: l.unitPriceCents,
          product_data: { name: `${l.title} (${FORMAT_LABEL[l.format]})`, description: `by ${l.author}` },
        },
      })),
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: totals.taxCents,
          product_data: { name: 'Sales tax (8.25%)' },
        },
      },
    ],
    discounts: couponId ? [{ coupon: couponId }] : undefined,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?cancelled=1`,
  });

  await db.update(payments).set({ stripeSessionId: session.id }).where(eq(payments.orderId, orderId));
  await logActivity('customer', userId, 'checkout.started', { orderId, totalCents: totals.totalCents });

  if (!session.url) throw new AppError('Stripe did not return a checkout page', 502);
  return { orderId, url: session.url };
}

export async function completeCheckout(userId: number, sessionId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.stripeSessionId, sessionId)).limit(1);
  const [order] = payment
    ? await db.select().from(orders).where(eq(orders.orderId, payment.orderId)).limit(1)
    : [];
  if (!payment || !order || order.userId !== userId) throw new NotFoundError('Order not found');

  // Refreshing the success page must not take stock twice
  if (payment.status !== 'pending') return { orderId: order.orderId, alreadyProcessed: true };

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  if (session.payment_status !== 'paid') {
    throw new BadRequestError("This order hasn't been paid yet. Return to checkout to finish paying.");
  }
  if (session.amount_total !== order.priceCents) {
    // Should never happen: the session was created from this order's total
    console.error('[checkout] Stripe total does not match order', { orderId: order.orderId });
    throw new AppError('Payment amount does not match the order. Please contact support.', 409);
  }

  const intent = session.payment_intent as Stripe.PaymentIntent | null;
  const charge = intent?.latest_charge as Stripe.Charge | null | undefined;
  const card = charge?.payment_method_details?.card;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.orderId));

  try {
    await db.transaction(async (tx) => {
      // Take the copies out of stock; fails if someone else bought the last ones meanwhile
      for (const item of items) {
        const [res] = (await tx
          .update(bookFormats)
          .set({ stock: sql`${bookFormats.stock} - ${item.quantity}` })
          .where(and(eq(bookFormats.bookId, item.bookId), eq(bookFormats.format, item.format), gte(bookFormats.stock, item.quantity)))) as unknown as [{ affectedRows: number }];
        if (!res.affectedRows) throw new ConflictError('OUT_OF_STOCK');
      }
      await tx
        .update(payments)
        .set({ status: 'completed', cardBrand: card?.brand ?? null, cardLast4: card?.last4 ?? null })
        .where(eq(payments.paymentId, payment.paymentId));

      // Empty the lines that were bought (anything added to the cart since stays)
      const [cart] = await tx.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (cart) {
        for (const item of items) {
          await tx.delete(cartItems).where(and(eq(cartItems.cartId, cart.cartId), eq(cartItems.bookId, item.bookId), eq(cartItems.format, item.format)));
        }
      }
    });
  } catch (err) {
    if (err instanceof ConflictError && intent) {
      // Paid, but the books sold out in the meantime: give the money back and cancel
      await stripe.refunds.create({ payment_intent: intent.id });
      await db.update(payments).set({ status: 'refunded' }).where(eq(payments.paymentId, payment.paymentId));
      await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.orderId, order.orderId));
      await logActivity('system', null, 'order.cancelled_out_of_stock', { orderId: order.orderId });
      throw new ConflictError('Sorry, a book in your order sold out while you were paying. You have been refunded.');
    }
    throw err;
  }

  await syncBookTotals();
  if (order.discountCodeId) await recordDiscountUse(order.discountCodeId);
  await logActivity('customer', userId, 'order.placed', { orderId: order.orderId, totalCents: order.priceCents });

  // Class-project safety net: reverse the (test) charge right away
  if (autoRefundEnabled() && intent) {
    try {
      await stripe.refunds.create({ payment_intent: intent.id });
      await db.update(payments).set({ status: 'refunded' }).where(eq(payments.paymentId, payment.paymentId));
      await logActivity('system', null, 'payment.auto_refunded', { orderId: order.orderId });
    } catch (e) {
      console.error('[checkout] auto-refund failed', e);
    }
  }

  return { orderId: order.orderId, alreadyProcessed: false };
}

// One order with its lines, address and payment, for the confirmation page and order history
export async function getOrderSummary(userId: number, orderId: number) {
  const [order] = await db.select().from(orders).where(and(eq(orders.orderId, orderId), eq(orders.userId, userId))).limit(1);
  if (!order) throw new NotFoundError('Order not found');
  const [items, [payment], address, [user]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1),
    usersRepo.findAddressByIdAndUser(order.shippingAddressId, userId),
    db.select({ email: users.email }).from(users).where(eq(users.userId, userId)).limit(1),
  ]);
  const { loadBooks } = await import('../books/catalog-repository');
  const books = await loadBooks([...new Set(items.map((i) => i.bookId))]);
  return {
    order,
    email: user?.email,
    address,
    payment: payment ? { status: payment.status, cardBrand: payment.cardBrand, cardLast4: payment.cardLast4 } : null,
    items: items.map((i) => {
      const b = books.find((x) => x.bookId === i.bookId);
      return { ...i, title: b?.title ?? `Book #${i.bookId}`, author: b?.author ?? '', isbn: b?.isbn ?? '', coverImageUrl: b?.coverImageUrl ?? null };
    }),
  };
}

