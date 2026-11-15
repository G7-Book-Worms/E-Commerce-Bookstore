// Email contents (SCRUM-212). Every email carries the class-project disclaimer.
// Anything a user typed is HTML-escaped before it goes into the HTML version.
import type { Email } from './mailer';
import { shipmentView } from '../orders/carriers';

const SITE = () => (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const DISCLAIMER =
  'Book Worms (bookwrms.store) was built by a group of students for a software engineering class at UTSA. ' +
  'It is not a real bookstore: no order will ever be shipped, and every payment is a Stripe test ' +
  'payment that is cancelled and refunded automatically. Please do not buy anything here.';

function layout(title: string, bodyHtml: string, bodyText: string): Pick<Email, 'html' | 'text'> {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Georgia,serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 28px;border-bottom:3px solid #14532d"><a href="${SITE()}" style="font-size:22px;font-weight:bold;color:#14532d;text-decoration:none">Book Worms</a></td></tr>
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55">
<h1 style="font-family:Georgia,serif;font-size:21px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#fef3c7;border-top:1px solid #fde68a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#78350f">
<strong>Class project notice:</strong> ${DISCLAIMER}
</td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#78716c;margin-top:12px">Sent by bookwrms.store. Questions? Reply to this email.</p>
</td></tr></table></body></html>`;
  const text = `${title}\n\n${bodyText}\n\n---\nCLASS PROJECT NOTICE: ${DISCLAIMER}\n`;
  return { html, text };
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#14532d;color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;

export function welcomeEmail(to: string, firstName: string): Email {
  const title = `Welcome to Book Worms, ${firstName}!`;
  return {
    to,
    subject: 'Welcome to Book Worms (class project)',
    ...layout(
      title,
      `<p>Your account is ready. You can browse the catalog, save books to your cart and try the checkout with a Stripe test card.</p>
${button(`${SITE()}/product-catalog`, 'Browse books')}
<p>If you didn't create this account, reply to this email and we'll remove it.</p>`,
      `Your account is ready: ${SITE()}/product-catalog\nIf you didn't create this account, reply to this email and we'll remove it.`
    ),
  };
}

export interface OrderEmailLine { title: string; format: string; quantity: number; unitPriceCents: number }
/** Where an order is going, as shown in its emails. */
export interface ShipTo {
  recipientName: string | null;
  phone: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/** "Shipping to" and "Order details" blocks: so a wrong address is caught before it ships. */
function orderFacts(o: { shipTo?: ShipTo | null; email?: string; paidWith?: string | null }) {
  const ship = o.shipTo;
  const shipLines = ship
    ? [ship.recipientName, ship.street, `${ship.city}, ${ship.state} ${ship.zip}`, ship.country, ship.phone].filter((l): l is string => !!l)
    : [];
  const html = `<table role="presentation" width="100%" style="font-size:14px;margin:18px 0;border-top:1px solid #e7e5e4"><tr>
${ship ? `<td valign="top" style="padding-top:12px;width:50%"><strong>Shipping to</strong><br>${shipLines.map(escapeHtml).join('<br>')}</td>` : ''}
<td valign="top" style="padding-top:12px"><strong>Order details</strong><br>${o.email ? `Email: ${escapeHtml(o.email)}<br>` : ''}${o.paidWith ? `Paid with: ${escapeHtml(o.paidWith)}` : 'Paid by card (Stripe test mode)'}</td>
</tr></table>
<p style="font-size:13px;color:#57534e">Something wrong with the address? Reply to this email before it ships.</p>`;
  const text = `${ship ? `\nShipping to:\n${shipLines.join('\n')}\n` : ''}${o.email ? `Email: ${o.email}\n` : ''}${o.paidWith ? `Paid with: ${o.paidWith}\n` : ''}`;
  return { html, text };
}

export interface OrderEmailData {
  orderId: number;
  firstName: string;
  shipTo?: ShipTo | null;
  email?: string;
  /** "Visa ending 4242"; never more of the card than Stripe gives us */
  paidWith?: string | null;
  lines: OrderEmailLine[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  refunded: boolean;
}

export function orderConfirmationEmail(to: string, o: OrderEmailData): Email {
  const rows = o.lines
    .map(
      (l) => `<tr><td style="padding:6px 0">${escapeHtml(l.title)} <span style="color:#78716c">(${escapeHtml(l.format)}) × ${l.quantity}</span></td><td align="right">${money(l.unitPriceCents * l.quantity)}</td></tr>`
    )
    .join('');
  const totals = `<tr><td style="padding-top:10px;border-top:1px solid #e7e5e4">Subtotal</td><td align="right" style="padding-top:10px;border-top:1px solid #e7e5e4">${money(o.subtotalCents)}</td></tr>
${o.discountCents ? `<tr><td>Discount</td><td align="right">−${money(o.discountCents)}</td></tr>` : ''}
<tr><td>Tax (8.25%)</td><td align="right">${money(o.taxCents)}</td></tr>
<tr><td><strong>Total</strong></td><td align="right"><strong>${money(o.totalCents)}</strong></td></tr>`;
  const refundNote = o.refunded
    ? '<p style="background:#ecfdf5;border:1px solid #a7f3d0;padding:10px;border-radius:6px">This was a Stripe <strong>test</strong> payment and it has already been refunded. Nothing will ship.</p>'
    : '<p>This was a Stripe test payment. Nothing will ship.</p>';
  return {
    to,
    subject: `Order #${o.orderId} received (class project: nothing will ship)`,
    ...layout(
      `Thanks for your order, ${o.firstName}`,
      `<p>We received order <strong>#${o.orderId}</strong>.</p>${refundNote}
<table role="presentation" width="100%" style="font-size:14px">${rows}${totals}</table>
${orderFacts(o).html}
${button(`${SITE()}/account?tab=orders`, 'View your orders')}`,
      `Order #${o.orderId}\n${o.lines.map((l) => `- ${l.title} (${l.format}) x${l.quantity}: ${money(l.unitPriceCents * l.quantity)}`).join('\n')}\nSubtotal ${money(o.subtotalCents)}${o.discountCents ? `\nDiscount -${money(o.discountCents)}` : ''}\nTax ${money(o.taxCents)}\nTotal ${money(o.totalCents)}\n${o.refunded ? 'This test payment has been refunded. ' : ''}Nothing will ship.\n${orderFacts(o).text}${SITE()}/account?tab=orders`
    ),
  };
}

const STATUS_TEXT: Record<string, string> = {
  pending: 'is being prepared',
  transit: 'is on its way (pretend shipping: this is a class project)',
  arrived: 'has been marked as delivered',
  cancelled: 'has been cancelled',
};

/**
 * The "your order moved on" email. `carrier` and `trackingNumber` are the two order columns;
 * when the carrier is known the email carries a link to that carrier's own tracking page.
 */
export function orderStatusEmail(
  to: string,
  firstName: string,
  orderId: number,
  status: string,
  carrier?: string | null,
  trackingNumber?: string | null,
  /** Guests have no account page: their signed order link instead */
  viewUrl?: string
): Email {
  const ordersUrl = viewUrl ?? `${SITE()}/account?tab=orders`;
  const line = `Your order #${orderId} ${STATUS_TEXT[status] ?? `is now "${status}"`}.`;
  const shipment = shipmentView(carrier, trackingNumber);

  // The tracking number is real and so is the carrier's page, even though nothing ships
  // from this class project: the number is whatever a staff member typed in.
  const trackingText = shipment
    ? `${shipment.carrierLabel ? `${shipment.carrierLabel} tracking number` : 'Tracking number'}: ${shipment.trackingNumber}`
    : '';
  const trackingHtml = shipment
    ? `<p style="margin:0 0 4px">${escapeHtml(trackingText)}</p>` +
      (shipment.trackingUrl
        ? `<p style="margin:0"><a href="${shipment.trackingUrl}" style="color:#14532d">Track it on ${escapeHtml(shipment.carrierLabel ?? 'the carrier')}'s website</a></p>`
        : '')
    : '';

  return {
    to,
    subject: `Order #${orderId} update`,
    ...layout(
      `Hi ${firstName}, there's an update`,
      `<p>${escapeHtml(line)}</p>${trackingHtml}${button(ordersUrl, viewUrl ? 'View your order' : 'View your orders and their status')}`,
      `${line}\n${trackingText}${shipment?.trackingUrl ? `\nTrack it: ${shipment.trackingUrl}` : ''}\n${viewUrl ? 'View your order' : 'View your orders and their status'}: ${ordersUrl}`
    ),
  };
}

export function passwordChangedEmail(to: string, firstName: string): Email {
  return {
    to,
    subject: 'Your Book Worms password was changed',
    ...layout(
      'Your password was changed',
      `<p>Hi ${escapeHtml(firstName)}, the password for your Book Worms account was just changed and every other device was signed out.</p>
<p>If this wasn't you, reset your password right away and reply to this email.</p>${button(`${SITE()}/forgot-password`, 'Reset password')}`,
      `Hi ${firstName}, your password was just changed and other devices were signed out. If this wasn't you, reset it: ${SITE()}/forgot-password`
    ),
  };
}

export function passwordResetEmail(to: string, firstName: string, token: string): Email {
  const link = `${SITE()}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'Reset your Book Worms password',
    ...layout(
      'Reset your password',
      `<p>Hi ${escapeHtml(firstName)}, someone (hopefully you) asked to reset your password. This link works once and expires in 30 minutes.</p>
${button(link, 'Choose a new password')}<p style="font-size:13px;color:#57534e">If you didn't ask for this, ignore this email; your password stays the same.</p>`,
      `Reset your password (works once, expires in 30 minutes): ${link}\nIf you didn't ask for this, ignore this email.`
    ),
  };
}

export function temporaryPasswordEmail(to: string, firstName: string, portal: 'customer' | 'staff'): Email {
  const where = portal === 'staff' ? `${SITE()}/staff-login` : `${SITE()}/user-login`;
  return {
    to,
    subject: 'Your Book Worms password was reset by staff',
    ...layout(
      'A staff member reset your password',
      `<p>Hi ${escapeHtml(firstName)}, a Book Worms staff member gave your account a temporary password. They'll share it with you directly; for safety it is never sent by email.</p>
<p>You'll be asked to choose a new password the next time you sign in.</p>${button(where, 'Sign in')}`,
      `Hi ${firstName}, a staff member gave your account a temporary password (shared with you directly, never by email). Choose a new one at your next sign-in: ${where}`
    ),
  };
}

export function contactReceivedEmail(to: string, name: string): Email {
  return {
    to,
    subject: 'We got your message',
    ...layout(
      `Thanks, ${name}`,
      '<p>We received your message and a staff member will reply from support@bookwrms.store.</p>',
      'We received your message and a staff member will reply from support@bookwrms.store.'
    ),
  };
}

export function contactReplyEmail(to: string, name: string, reply: string, original: string): Email {
  const quote = (s: string) => escapeHtml(s).replace(/\n/g, '<br>');
  return {
    to,
    from: 'support',
    subject: 'Re: your message to Book Worms',
    ...layout(
      `Hi ${name}`,
      `<p>${quote(reply)}</p><p style="margin-top:20px;padding-left:12px;border-left:3px solid #d6d3d1;color:#57534e;font-size:13px">Your message:<br>${quote(original)}</p>`,
      `${reply}\n\n> Your message:\n> ${original.replace(/\n/g, '\n> ')}`
    ),
  };
}

export function lowStockEmail(to: string, items: { title: string; format: string; stock: number; threshold: number }[]): Email {
  const list = items.map((i) => `<li>${escapeHtml(i.title)} (${escapeHtml(i.format)}): <strong>${i.stock}</strong> left (alert at ${i.threshold})</li>`).join('');
  return {
    to,
    subject: `Low stock: ${items.length} item${items.length === 1 ? '' : 's'} need restocking`,
    ...layout(
      'Low stock alert',
      `<ul>${list}</ul>${button(`${SITE()}/admin/inventory?filter=low`, 'Open inventory')}`,
      `${items.map((i) => `- ${i.title} (${i.format}): ${i.stock} left`).join('\n')}\n${SITE()}/admin/inventory?filter=low`
    ),
  };
}

// --- Support tickets (Session 4) -------------------------------------------------------------
// Everything below echoes customer-supplied text (a ticket subject, a reply, the quoted
// history) into HTML, so every one of those values goes through escapeHtml() first. `layout()`
// already escapes the title it is given.

/** Acknowledgement sent when a ticket is opened, carrying the number the customer can quote. */
export function ticketReceivedEmail(to: string, name: string, ticketNumber: number, subject: string): Email {
  return {
    to,
    from: 'support',
    subject: `[Ticket #${ticketNumber}] ${subject}`,
    ...layout(
      `Thanks, ${name}`,
      `<p>We received your message and opened ticket <strong>#${ticketNumber}</strong>. A staff member will reply from support@bookwrms.store.</p>
<p style="margin-top:20px;padding-left:12px;border-left:3px solid #d6d3d1;color:#57534e;font-size:13px">Subject: ${escapeHtml(subject)}</p>
<p style="font-size:13px;color:#57534e">Replying to this email adds your reply to the same ticket.</p>`,
      `We received your message and opened ticket #${ticketNumber}. A staff member will reply from support@bookwrms.store.\n\nSubject: ${subject}\n\nReplying to this email adds your reply to the same ticket.`
    ),
  };
}

/**
 * A staff reply on a ticket. The subject is built by buildReplySubject() in the tickets module
 * so that the `[Ticket #n]` token stays exactly in step with the matcher that reads it back.
 */
export function ticketReplyEmail(
  to: string,
  opts: { replySubject: string; ticketNumber: number; body: string; quoted?: string | null }
): Email {
  const quote = (s: string) => escapeHtml(s).replace(/\n/g, '<br>');
  const history = opts.quoted
    ? `<p style="margin-top:20px;padding-left:12px;border-left:3px solid #d6d3d1;color:#57534e;font-size:13px">Previously:<br>${quote(opts.quoted)}</p>`
    : '';
  return {
    to,
    from: 'support',
    subject: opts.replySubject,
    ...layout(
      `Ticket #${opts.ticketNumber}`,
      `<p>${quote(opts.body)}</p>${history}
<p style="font-size:13px;color:#57534e">Reply to this email to continue on ticket #${opts.ticketNumber}.</p>`,
      `${opts.body}\n${opts.quoted ? `\n> Previously:\n> ${opts.quoted.replace(/\n/g, '\n> ')}\n` : ''}\nReply to this email to continue on ticket #${opts.ticketNumber}.`
    ),
  };
}

// --- Guest checkout (SCRUM-208) -------------------------------------------------------------

export interface GuestOrderEmailData extends Omit<OrderEmailData, 'firstName'> {
  /** Signed, expiring token for this one order (see checkout/guest-order-token.ts). */
  viewToken: string;
}

/**
 * Order confirmation for someone who bought without an account. The only way back to the order
 * is the signed link below, so the email says so and warns that forwarding it shares the order.
 * The token is in the link and nowhere else: it is never logged.
 */
export function guestOrderConfirmationEmail(to: string, o: GuestOrderEmailData): Email {
  const link = `${SITE()}/checkout/guest-order?token=${encodeURIComponent(o.viewToken)}`;
  const rows = o.lines
    .map(
      (l) => `<tr><td style="padding:6px 0">${escapeHtml(l.title)} <span style="color:#78716c">(${escapeHtml(l.format)}) × ${l.quantity}</span></td><td align="right">${money(l.unitPriceCents * l.quantity)}</td></tr>`
    )
    .join('');
  const totals = `<tr><td style="padding-top:10px;border-top:1px solid #e7e5e4">Subtotal</td><td align="right" style="padding-top:10px;border-top:1px solid #e7e5e4">${money(o.subtotalCents)}</td></tr>
${o.discountCents ? `<tr><td>Discount</td><td align="right">−${money(o.discountCents)}</td></tr>` : ''}
<tr><td>Tax (8.25%)</td><td align="right">${money(o.taxCents)}</td></tr>
<tr><td><strong>Total</strong></td><td align="right"><strong>${money(o.totalCents)}</strong></td></tr>`;
  const refundNote = o.refunded
    ? '<p style="background:#ecfdf5;border:1px solid #a7f3d0;padding:10px;border-radius:6px">This was a Stripe <strong>test</strong> payment and it has already been refunded. Nothing will ship.</p>'
    : '<p>This was a Stripe test payment. Nothing will ship.</p>';
  return {
    to,
    subject: `Order #${o.orderId} received (class project: nothing will ship)`,
    ...layout(
      'Thanks for your order',
      `<p>We received order <strong>#${o.orderId}</strong>. You checked out as a guest, so this link is how you look it up — it works for this one order only and expires in 30 days.</p>${refundNote}
<table role="presentation" width="100%" style="font-size:14px">${rows}${totals}</table>
${orderFacts(o).html}
${button(link, 'View your order')}
<p style="font-size:13px;color:#57534e">The link asks for this email address before it shows the order. You can also look it up any time at ${SITE()}/checkout/guest-order with order number <strong>${o.orderId}</strong> and this email address. Creating an account with this email keeps your orders in one place instead.</p>`,
      `Order #${o.orderId}\n${o.lines.map((l) => `- ${l.title} (${l.format}) x${l.quantity}: ${money(l.unitPriceCents * l.quantity)}`).join('\n')}\nSubtotal ${money(o.subtotalCents)}${o.discountCents ? `\nDiscount -${money(o.discountCents)}` : ''}\nTax ${money(o.taxCents)}\nTotal ${money(o.totalCents)}\n${o.refunded ? 'This test payment has been refunded. ' : ''}Nothing will ship.\n${orderFacts(o).text}\nView this order (this one order only, expires in 30 days; don't forward it):\n${link}`
    ),
  };
}

// --- Two-step sign-in and security alerts ---------------------------------------------------

/** The one-time sign-in code. `forAccount` is set when a demo account's code is redirected. */
export function signInCodeEmail(to: string, firstName: string, code: string, portal: 'customer' | 'staff', forAccount?: string): Email {
  const where = portal === 'staff' ? 'the Book Worms staff portal' : 'your Book Worms account';
  const demo = forAccount
    ? `<p style="font-size:13px;color:#57534e">Demo account <strong>${escapeHtml(forAccount)}</strong> has no real inbox, so its code comes to this shared support inbox.</p>`
    : '';
  return {
    to,
    // The code stays out of the subject: subjects show up in notifications, logs and inbox lists
    subject: 'Your Book Worms sign-in code',
    secret: true,
    ...layout(
      `Your sign-in code, ${firstName}`,
      `<p>Use this code to finish signing in to ${where}:</p>
<p style="font-size:30px;letter-spacing:6px;font-weight:bold;font-family:'Courier New',monospace;margin:18px 0">${code}</p>
<p>It works once and expires in 10 minutes. Book Worms staff will never ask you for it.</p>
<p style="font-size:13px;color:#57534e">Didn't try to sign in? Someone has your password: change it now and nothing else is needed, since they can't get in without this code.</p>${demo}`,
      `Your Book Worms sign-in code is ${code}. It works once and expires in 10 minutes. Staff will never ask you for it.\nDidn't try to sign in? Someone has your password: change it now.${forAccount ? `\n(Demo account ${forAccount}: its code comes to this shared support inbox.)` : ''}`
    ),
  };
}

/**
 * A security alert: something happened to the account that its owner should know about.
 * `facts` are short "label: value" lines (time, IP address, what changed).
 */
export function securityAlertEmail(
  to: string,
  firstName: string,
  alert: { subject: string; headline: string; body: string; facts: [string, string][] },
  portal: 'customer' | 'staff'
): Email {
  const fix = portal === 'staff'
    ? 'If this wasn\'t you, change your password from the staff portal right away and tell an administrator.'
    : `If this wasn't you, reset your password at ${SITE()}/forgot-password right away.`;
  const rows = alert.facts
    .map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#57534e">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  return {
    to,
    subject: `Security alert: ${alert.subject}`,
    ...layout(
      `${alert.headline}, ${firstName}`,
      `<p>${escapeHtml(alert.body)}</p><table role="presentation" style="font-size:14px;margin:12px 0">${rows}</table>
<p style="background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:6px">${escapeHtml(fix)}</p>`,
      `${alert.body}\n${alert.facts.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${fix}`
    ),
  };
}
