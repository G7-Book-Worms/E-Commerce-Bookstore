// server/src/modules/users/privacy-service.ts
// "Download my data" and "Delete my account" (SCRUM-216, textbook Ch 7.5: people can see and
// erase what a site holds about them).
//
// Export: one JSON file with everything stored about the signed-in customer: profile, addresses,
// orders with their items and payments (card brand and last four only; we never had more), cart,
// messages and support tickets sent with their email, sign-in settings, passkeys, and their own
// activity log. Secrets are never included: no password hash, authenticator secret or keys.
//
// Delete: needs the password and the word DELETE. The account is anonymised exactly as when staff
// delete one (customers-admin.ts): name, email, phone and addresses are scrubbed, sign-in is
// impossible, passkeys and two-step settings go. Orders stay, without personal details, because a
// store has to keep sales records; they no longer point at anyone. Messages and tickets sent with
// the email are scrubbed too.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import {
  activityLog, addresses, books, cartItems, carts, contactMessages, mfaChallenges, orderItems, orders, passkeys,
  passwordResetTokens, payments, ticketMessages, tickets, users,
} from '../../../db/schema';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error';
import { rateLimit } from '../../shared/security/rate-limit';
import { comparePassword } from '../../shared/utils/hash-utils';
import { logActivity } from '../activity/activity-log';
import { sendEmail } from '../email/mailer';
import { accountDeletedEmail } from '../email/templates';
import { anonymiseCustomer, unusablePasswordHash } from './customers-admin';

export async function exportCustomerData(userId: number, ip: string | null) {
  await rateLimit(`privacy:export:${userId}`, 10, 60 * 60);
  const [u] = await db.select().from(users).where(eq(users.userId, userId));
  if (!u || !u.isActive) throw new UnauthorizedError('Please sign in again');

  const myOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.created));
  const orderIds = myOrders.map((o) => o.orderId);
  const [items, pays, addr, cart, msgs, tix, pks, log] = await Promise.all([
    orderIds.length
      ? db.select({ orderId: orderItems.orderId, title: books.title, author: books.author, isbn: books.isbn, format: orderItems.format, quantity: orderItems.quantity, unitPrice: orderItems.unitPrice })
          .from(orderItems).leftJoin(books, eq(books.bookId, orderItems.bookId)).where(inArray(orderItems.orderId, orderIds))
      : [],
    orderIds.length
      ? db.select({ orderId: payments.orderId, status: payments.status, amount: payments.amount, cardBrand: payments.cardBrand, cardLast4: payments.cardLast4, created: payments.created })
          .from(payments).where(inArray(payments.orderId, orderIds))
      : [],
    db.select().from(addresses).where(eq(addresses.userId, userId)),
    db.select({ title: books.title, format: cartItems.format, quantity: cartItems.quantity })
      .from(cartItems).innerJoin(carts, eq(carts.cartId, cartItems.cartId)).leftJoin(books, eq(books.bookId, cartItems.bookId))
      .where(eq(carts.userId, userId)),
    db.select({ name: contactMessages.name, email: contactMessages.email, message: contactMessages.message, status: contactMessages.status, reply: contactMessages.reply, created: contactMessages.created })
      .from(contactMessages).where(eq(contactMessages.email, u.email)),
    db.select().from(tickets).where(eq(tickets.customerEmail, u.email)),
    db.select({ name: passkeys.name, created: passkeys.created, lastUsedAt: passkeys.lastUsedAt })
      .from(passkeys).where(and(eq(passkeys.actorType, 'customer'), eq(passkeys.actorId, userId))),
    db.select({ action: activityLog.action, details: activityLog.details, ip: activityLog.ip, created: activityLog.created })
      .from(activityLog).where(and(eq(activityLog.actorType, 'customer'), eq(activityLog.actorId, userId)))
      .orderBy(desc(activityLog.created)).limit(1000),
  ]);
  const ticketIds = tix.map((t) => t.ticketId);
  const ticketMsgs = ticketIds.length
    ? await db.select({ ticketId: ticketMessages.ticketId, direction: ticketMessages.direction, body: ticketMessages.body, created: ticketMessages.created })
        .from(ticketMessages).where(inArray(ticketMessages.ticketId, ticketIds))
    : [];
  const addressById = new Map(addr.map((a) => [a.addressId, a]));

  const data = {
    about: 'Everything Book Worms (bookwrms.store, a class project) stores about your account. Passwords, authenticator secrets and passkey private keys are never stored in a readable form, so they are not here.',
    exportedAt: new Date().toISOString(),
    profile: {
      firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone,
      created: u.created, updated: u.updated,
    },
    signInSettings: {
      twoStepMethod: u.mfaMethod,
      textMessagePhone: u.mfaPhone,
      orderUpdatesByText: u.smsOrderUpdates,
      passkeys: pks,
    },
    addresses: addr.map((a) => ({ recipientName: a.recipientName, phone: a.phone, street: a.street, city: a.city, state: a.state, zip: a.zip, country: a.country, isDefault: a.isDefault })),
    orders: myOrders.map((o) => {
      const ship = o.shippingAddressId ? addressById.get(o.shippingAddressId) : undefined;
      return {
        orderNumber: o.orderId, status: o.status, placed: o.created, note: o.note,
        subtotalCents: o.subtotalCents, discountCents: o.discountCents, taxCents: o.taxCents, totalCents: o.priceCents,
        tracking: o.trackingNumber ? { carrier: o.carrier, number: o.trackingNumber } : null,
        shippedTo: ship ? { recipientName: ship.recipientName, street: ship.street, city: ship.city, state: ship.state, zip: ship.zip, country: ship.country } : null,
        items: items.filter((i) => i.orderId === o.orderId).map(({ orderId: _o, ...i }) => i),
        payments: pays.filter((p) => p.orderId === o.orderId).map(({ orderId: _o, ...p }) => p),
      };
    }),
    cart,
    messagesToSupport: msgs,
    supportTickets: tix.map((t) => ({
      number: t.number, subject: t.subject, status: t.status, created: t.created,
      messages: ticketMsgs.filter((m) => m.ticketId === t.ticketId).map(({ ticketId: _t, ...m }) => m),
    })),
    activity: log,
  };
  await logActivity('customer', userId, 'privacy.data_exported', { orders: myOrders.length }, ip);
  return { data, fileName: `bookworms-my-data-${new Date().toISOString().slice(0, 10)}.json` };
}

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password').max(200),
  confirm: z.string().trim(),
});

export async function deleteOwnAccount(userId: number, input: z.infer<typeof deleteAccountSchema>, ip: string | null) {
  await rateLimit(`privacy:delete:${userId}`, 5, 15 * 60);
  if (input.confirm.toUpperCase() !== 'DELETE') throw new BadRequestError('Type DELETE to confirm.');
  const [u] = await db.select().from(users).where(eq(users.userId, userId));
  if (!u || !u.isActive) throw new UnauthorizedError('Please sign in again');
  if (!(await comparePassword(input.password, u.passwordHash))) {
    await logActivity('customer', userId, 'security.settings_wrong_password', { setting: 'delete account' }, ip);
    throw new UnauthorizedError('That password isn\'t right. Your account was not deleted.');
  }

  // Tell them first, while we still have the address
  await sendEmail(accountDeletedEmail(u.email, u.firstName)).catch(() => false);

  const { email } = await anonymiseCustomer(userId, await unusablePasswordHash());
  // Cart, pending codes and reset links go entirely
  const myCarts = await db.select({ id: carts.cartId }).from(carts).where(eq(carts.userId, userId));
  if (myCarts.length) {
    await db.delete(cartItems).where(inArray(cartItems.cartId, myCarts.map((c) => c.id)));
    await db.delete(carts).where(eq(carts.userId, userId));
  }
  await db.delete(mfaChallenges).where(and(eq(mfaChallenges.actorType, 'customer'), eq(mfaChallenges.actorId, userId)));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  // Messages they sent support: keep the conversation for staff, drop who it was from
  const gone = '[deleted]';
  await db.update(contactMessages).set({ name: gone, email: gone }).where(eq(contactMessages.email, email));
  const tix = await db.select({ id: tickets.ticketId }).from(tickets).where(eq(tickets.customerEmail, email));
  if (tix.length) {
    await db.update(tickets).set({ customerName: gone, customerEmail: gone, userId: null }).where(inArray(tickets.ticketId, tix.map((t) => t.id)));
    await db.update(ticketMessages).set({ fromEmail: gone }).where(and(inArray(ticketMessages.ticketId, tix.map((t) => t.id)), sql`${ticketMessages.direction} = 'in'`));
  }
  // The audit entry keeps no personal details: the account id is enough to connect it to the orders
  await logActivity('customer', userId, 'privacy.account_deleted', { byCustomer: true }, ip);
}
