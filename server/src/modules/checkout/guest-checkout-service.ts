// server/src/modules/checkout/guest-checkout-service.ts
// Guest checkout (SCRUM-208): buy without registering.
//
// It mirrors the signed-in flow in checkout-service.ts (price on the server -> save the order as
// "awaiting payment" -> pay on Stripe's page -> verify with Stripe, take stock, confirm), with
// three differences:
//   1. there is no account, so the cart arrives from the browser's localStorage and every line is
//      re-priced here from the book id and format (see ../cart/guest-cart.ts);
//   2. orders.shipping_address_id is NOT NULL, so the address the guest typed is inserted as its
//      own addresses row with user_id = NULL, and orders.user_id is NULL;
//   3. the confirmation email links to the order through a signed, expiring token instead of the
//      account's order history (see ./guest-order-token.ts).
//
// It is deliberately a separate module rather than a refactor of the working signed-in checkout
// days before the class demo. If the two drift, this is the file to reconcile.
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type Stripe from 'stripe';
import { db } from '../../../db';
import { addresses, orderItems, orders, payments } from '../../../db/schema';
import { guestCartSchema, priceGuestCart, assertGuestCartInStock } from '../cart/guest-cart';
import { recordDiscountUse } from '../discounts/discounts-repository';
import { syncBookTotals } from '../books/book-totals';
import { getStripe, autoRefundEnabled } from '../payments/stripe';
import { logActivity } from '../activity/activity-log';
import { alertLowStock, changeStock, type StockChange } from '../inventory/inventory-service';
import { sendEmail } from '../email/mailer';
import { guestOrderConfirmationEmail } from '../email/templates';
import { signGuestOrderToken, verifyGuestOrderToken } from './guest-order-token';
import { AppError, BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error';

const dollars = (cents: number) => (cents / 100).toFixed(2);
const FORMAT_LABEL = { hardcover: 'Hardcover', paperback: 'Paperback' } as const;

// --- what the browser may send -------------------------------------------------------------
// Lengths match the addresses table (varchar(100) / varchar(20)) so an over-long value is a
// clean 400 instead of a MySQL error.
const guestAddressSchema = z.object({
  street: z.string().trim().min(1, 'Street is required').max(100, 'Street is too long'),
  city: z.string().trim().min(1, 'City is required').max(100, 'City is too long'),
  state: z.string().trim().min(1, 'State is required').max(100, 'State is too long'),
  zip: z.string().trim().min(1, 'ZIP code is required').max(20, 'ZIP code is too long'),
  country: z.string().trim().min(1, 'Country is required').max(100, 'Country is too long'),
});

export const guestQuoteSchema = z.object({
  items: guestCartSchema,
  discountCode: z.string().trim().max(32).optional(),
});

export const startGuestCheckoutSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Enter your email address')
    .max(100, 'Email address is too long')
    .email('Enter a valid email address'),
  address: guestAddressSchema,
  items: guestCartSchema,
  discountCode: z.string().trim().max(32).optional(),
  note: z.string().trim().max(500, 'Order note is too long').optional(),
});

export const completeGuestCheckoutSchema = z.object({
  sessionId: z.string().startsWith('cs_', 'Invalid checkout session').max(255),
});

export const guestOrderTokenSchema = z.object({
  token: z.string().min(20, 'This order link is invalid or has expired').max(1024),
});

export type StartGuestCheckoutInput = z.infer<typeof startGuestCheckoutSchema>;

// --- 1. start -------------------------------------------------------------------------------

export async function startGuestCheckout(input: StartGuestCheckoutInput, origin: string) {
  const stripe = getStripe(); // fail before saving anything if payments aren't configured

  // Re-price the whole basket here. The browser's prices, totals and discount are never used.
  const cart = await priceGuestCart(input.items, input.discountCode);
  if (cart.items.length === 0) throw new BadRequestError('Your cart is empty');
  if (input.discountCode && cart.discountError) throw new BadRequestError(cart.discountError);
  assertGuestCartInStock(cart.items);

  const { totals } = cart;
  if (totals.totalCents < 50) throw new BadRequestError('Orders must be at least $0.50 to pay by card');

  // One transaction: the guest's address, the order, its lines and the pending payment.
  const orderId = await db.transaction(async (tx) => {
    const [addressRes] = (await tx.insert(addresses).values({
      userId: null, // not tied to an account
      street: input.address.street,
      city: input.address.city,
      state: input.address.state,
      zip: input.address.zip,
      country: input.address.country,
      isDefault: false,
    })) as unknown as [{ insertId: number }];

    const [orderRes] = (await tx.insert(orders).values({
      userId: null, // guest order
      status: 'pending',
      shippingAddressId: addressRes.insertId,
      note: input.note,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      taxCents: totals.taxCents,
      discountCodeId: cart.discount?.discountCodeId ?? null,
      priceCents: totals.totalCents,
      // Where to send the confirmation, and the only contact detail we hold for this order:
      // there is no account behind it. Validated and lower-cased by startGuestCheckoutSchema.
      guestEmail: input.email,
    })) as unknown as [{ insertId: number }];

    await tx.insert(orderItems).values(
      cart.items.map((l) => ({
        orderId: orderRes.insertId,
        bookId: l.bookId,
        format: l.format,
        quantity: l.quantity,
        unitPrice: dollars(l.unitPriceCents), // the price charged (sale price when on sale)
      }))
    );
    await tx.insert(payments).values({
      orderId: orderRes.insertId,
      cardProvider: 'stripe',
      amount: dollars(totals.totalCents),
      status: 'pending',
    });
    return orderRes.insertId;
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
    customer_email: input.email,
    client_reference_id: String(orderId),
    // Nothing personal beyond the email Stripe already has as customer_email.
    metadata: { orderId: String(orderId), guest: '1' },
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
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&guest=1`,
    cancel_url: `${origin}/checkout?cancelled=1`,
  });

  await db.update(payments).set({ stripeSessionId: session.id }).where(eq(payments.orderId, orderId));
  // No email, address or token in the log: only which order and how much.
  await logActivity('system', null, 'checkout.guest_started', { orderId, totalCents: totals.totalCents });

  if (!session.url) throw new AppError('Stripe did not return a checkout page', 502);
  return { orderId, url: session.url };
}

// --- 2. complete ----------------------------------------------------------------------------

/** The guest order behind a Stripe session, or 404. Never returns an order that has an account. */
async function findGuestOrderBySession(sessionId: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.stripeSessionId, sessionId)).limit(1);
  const [order] = payment
    ? await db
        .select()
        .from(orders)
        .where(and(eq(orders.orderId, payment.orderId), isNull(orders.userId)))
        .limit(1)
    : [];
  if (!payment || !order) throw new NotFoundError('Order not found');
  return { payment, order };
}

export async function completeGuestCheckout(sessionId: string) {
  const { payment, order } = await findGuestOrderBySession(sessionId);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });
  // The email we stored when the order was created, not whatever Stripe echoes back: it is the
  // address this order was actually placed with, and it is one less round trip to trust.
  const email = order.guestEmail;
  const viewToken = signGuestOrderToken(order.orderId);

  // Refreshing the success page must not take stock twice
  if (payment.status !== 'pending') {
    return { orderId: order.orderId, alreadyProcessed: true, email, viewToken };
  }

  if (session.payment_status !== 'paid') {
    throw new BadRequestError("This order hasn't been paid yet. Return to checkout to finish paying.");
  }
  if (session.amount_total !== order.priceCents) {
    // Should never happen: the session was created from this order's total
    console.error('[guest-checkout] Stripe total does not match order', { orderId: order.orderId });
    throw new AppError('Payment amount does not match the order. Please contact support.', 409);
  }

  const intent = session.payment_intent as Stripe.PaymentIntent | null;
  const charge = intent?.latest_charge as Stripe.Charge | null | undefined;
  const card = charge?.payment_method_details?.card;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.orderId));

  const stockChanges: StockChange[] = [];
  try {
    await db.transaction(async (tx) => {
      // Take the copies out of stock (row-locked, logged as inventory movements);
      // fails if someone else bought the last ones meanwhile
      for (const item of items) {
        stockChanges.push(
          await changeStock(tx, { bookId: item.bookId, format: item.format }, -item.quantity, 'sale', {
            orderId: order.orderId,
          })
        );
      }
      await tx
        .update(payments)
        .set({ status: 'completed', cardBrand: card?.brand ?? null, cardLast4: card?.last4 ?? null })
        .where(eq(payments.paymentId, payment.paymentId));
      // Nothing to empty: a guest's cart lives in their browser, and the success page clears it.
    });
  } catch (err) {
    if (err instanceof ConflictError && err.message === 'OUT_OF_STOCK' && intent) {
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
  await logActivity('system', null, 'order.placed_as_guest', { orderId: order.orderId, totalCents: order.priceCents });
  await alertLowStock(stockChanges);

  // Class-project safety net: reverse the (test) charge right away
  let refunded = false;
  if (autoRefundEnabled() && intent) {
    try {
      await stripe.refunds.create({ payment_intent: intent.id });
      await db.update(payments).set({ status: 'refunded' }).where(eq(payments.paymentId, payment.paymentId));
      refunded = true;
      await logActivity('system', null, 'payment.auto_refunded', { orderId: order.orderId });
    } catch (e) {
      console.error('[guest-checkout] auto-refund failed', e);
    }
  }

  if (email) await sendGuestOrderConfirmation(email, order.orderId, viewToken, refunded);
  return { orderId: order.orderId, alreadyProcessed: false, email, viewToken };
}

// --- 3. the signed "view your order" link ---------------------------------------------------

/**
 * One guest order, for the holder of a valid signed link. The order id comes out of the token,
 * never from the URL, so a link can only ever open the order it was signed for.
 *
 * It deliberately does NOT return the guest's email or street: a confirmation email can be
 * forwarded, so the page shows only enough to recognise the order (lines, totals, status, the
 * town it ships to and the card's last four digits).
 */
export async function getGuestOrderByToken(token: string) {
  const orderId = verifyGuestOrderToken(token);

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderId, orderId), isNull(orders.userId)))
    .limit(1);
  if (!order) throw new NotFoundError('Order not found');

  const [items, [payment], [address]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.orderId)),
    db.select().from(payments).where(eq(payments.orderId, order.orderId)).limit(1),
    db
      .select({ city: addresses.city, state: addresses.state, zip: addresses.zip, country: addresses.country })
      .from(addresses)
      .where(eq(addresses.addressId, order.shippingAddressId))
      .limit(1),
  ]);

  const { loadBooks } = await import('../books/catalog-repository');
  const catalog = await loadBooks([...new Set(items.map((i) => i.bookId))]);

  return {
    order: {
      orderId: order.orderId,
      status: order.status,
      created: order.created,
      trackingNumber: order.trackingNumber,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      taxCents: order.taxCents,
      priceCents: order.priceCents,
    },
    payment: payment
      ? { status: payment.status, cardBrand: payment.cardBrand, cardLast4: payment.cardLast4 }
      : null,
    // Town-level only, on purpose (see above)
    shipTo: address ? { city: address.city, state: address.state, zip: address.zip, country: address.country } : null,
    items: items.map((i) => {
      const b = catalog.find((x) => x.bookId === i.bookId);
      return {
        orderItemId: i.orderItemId,
        title: b?.title ?? `Book #${i.bookId}`,
        author: b?.author ?? '',
        isbn: b?.isbn ?? '',
        format: i.format,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      };
    }),
  };
}

/** Confirmation email with the signed link. The token is never logged. */
async function sendGuestOrderConfirmation(email: string, orderId: number, viewToken: string, refunded: boolean) {
  try {
    const summary = await getGuestOrderByToken(viewToken);
    await sendEmail(
      guestOrderConfirmationEmail(email, {
        orderId,
        viewToken,
        lines: summary.items.map((i) => ({
          title: i.title,
          format: FORMAT_LABEL[i.format],
          quantity: i.quantity,
          unitPriceCents: Math.round(Number(i.unitPrice) * 100),
        })),
        subtotalCents: summary.order.subtotalCents,
        discountCents: summary.order.discountCents,
        taxCents: summary.order.taxCents,
        totalCents: summary.order.priceCents,
        refunded: refunded || summary.payment?.status === 'refunded',
      })
    );
  } catch (err) {
    // A failed email must not fail an order the shopper already paid for.
    console.error('[guest-checkout] confirmation email failed for order', orderId, err);
  }
}
