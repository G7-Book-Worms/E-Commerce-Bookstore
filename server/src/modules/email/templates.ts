// Email contents (SCRUM-212). Every email carries the class-project disclaimer.
// Anything a user typed is HTML-escaped before it goes into the HTML version.
import type { Email } from './mailer';
import { shipmentView } from '../orders/carriers';
import { siteUrl } from '../../shared/utils/site-url';

const SITE = () => siteUrl();

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const DISCLAIMER =
  'Book Worms (bookwrms.store) is a student project built for a software engineering course at UTSA. ' +
  'It is not a real store: orders are never shipped, and every payment is a Stripe test payment that is ' +
  'refunded automatically. Please do not use a real card.';

/** Where a customer can reach a person: replying works too, since replies go to the support inbox. */
const SUPPORT_LINK = () => `${SITE()}/#contact`;

/** A red "SECURITY ALERT" label shown above the heading of security emails. */
const SECURITY_BADGE = `<p style="margin:0 0 10px"><span style="display:inline-block;background:#b91c1c;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:4px 8px;border-radius:4px">&#9888; Security Alert</span></p>`;

function layout(title: string, bodyHtml: string, bodyText: string, opts: { security?: boolean } = {}): Pick<Email, 'html' | 'text'> {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Georgia,serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:8px" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 28px;border-bottom:3px solid #1c1917"><a href="${SITE()}" style="font-size:22px;font-weight:bold;color:#1c1917;text-decoration:none">Book Worms</a></td></tr>
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55">
${opts.security ? SECURITY_BADGE : ''}<h1 style="font-family:Georgia,serif;font-size:21px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;background:#fef3c7;border-top:1px solid #fde68a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#78350f">
<strong>Class Project Notice:</strong> ${DISCLAIMER}
</td></tr></table>
<p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#78716c;margin-top:12px">This is an automated message from Book Worms. Need help? Reply to this email or <a href="${SUPPORT_LINK()}" style="color:#57534e">contact support</a>.</p>
</td></tr></table></body></html>`;
  const text = `${opts.security ? 'SECURITY ALERT: ' : ''}${title}\n\n${bodyText}\n\nNeed help? Reply to this email or contact support: ${SUPPORT_LINK()}\n\n---\nCLASS PROJECT NOTICE: ${DISCLAIMER}\n`;
  return { html, text };
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#1c1917;color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;

/** "Key: value" rows, e.g. the time and IP address of a security event. */
function factsTable(facts: [string, string][]) {
  return {
    html: `<table role="presentation" style="font-size:14px;margin:12px 0 18px">${facts
      .map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#57534e;white-space:nowrap">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
      .join('')}</table>`,
    text: facts.map(([k, v]) => `${k}: ${v}`).join('\n'),
  };
}

/** Sign-up: the code that proves the new account's email address is theirs. */
export function verifyEmailCodeEmail(to: string, firstName: string, code: string, forAddress?: string): Email {
  const demo = forAddress
    ? `<p style="font-size:13px;color:#57534e">Demo address <strong>${escapeHtml(forAddress)}</strong> has no real inbox, so its code comes to this shared support inbox.</p>`
    : '';
  return {
    to,
    // The code stays out of the subject: subjects show up in notifications, logs and inbox lists
    subject: 'Verify Your Email Address for Book Worms',
    secret: true,
    ...layout(
      'Verify Your Email Address',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>Enter the verification code below on the sign-up page to finish creating your Book Worms account.</p>
<p style="font-size:30px;letter-spacing:6px;font-weight:bold;font-family:'Courier New',monospace;margin:18px 0">${code}</p>
<p>This code expires in 15 minutes. Book Worms staff will never ask you for it.</p>
<p style="font-size:13px;color:#57534e">Didn't sign up? You can safely ignore this email. No account is created without this code.</p>${demo}`,
      `Hello ${firstName},\n\nYour Book Worms verification code is ${code}. Enter it on the sign-up page to finish creating your account. It expires in 15 minutes.\n\nDidn't sign up? You can safely ignore this email. No account is created without this code.${forAddress ? `\n(Demo address ${forAddress}: its code comes to this shared support inbox.)` : ''}`
    ),
  };
}

/**
 * Someone tried to sign up with an address that already has an account. The sign-up page looks
 * the same either way; only this email (to the real owner) says the account exists.
 */
export function accountAlreadyExistsEmail(to: string, forAddress?: string): Email {
  const demo = forAddress ? `<p style="font-size:13px;color:#57534e">Sent for demo address <strong>${escapeHtml(forAddress)}</strong>, which has no real inbox.</p>` : '';
  return {
    to,
    subject: 'You Already Have a Book Worms Account',
    ...layout(
      'You Already Have an Account',
      `<p>Hello,</p>
<p>Someone, hopefully you, tried to create a new Book Worms account with this email address. An account with this address already exists, so no new account was created.</p>
${button(`${SITE()}/user-login`, 'Sign In')}
<p>Forgot your password? <a href="${SITE()}/forgot-password" style="color:#1c1917">Reset it here</a>.</p>
<p style="font-size:13px;color:#57534e">Didn't try to sign up? You can safely ignore this email. Your account has not changed.</p>${demo}`,
      `Hello,\n\nSomeone, hopefully you, tried to create a new Book Worms account with this email address. An account with this address already exists, so no new account was created.\n\nSign in: ${SITE()}/user-login\nForgot your password? ${SITE()}/forgot-password\n\nDidn't try to sign up? You can safely ignore this email. Your account has not changed.`
    ),
  };
}

export function welcomeEmail(to: string, firstName: string): Email {
  return {
    to,
    subject: 'Welcome to Book Worms',
    ...layout(
      `Welcome to Book Worms, ${firstName}`,
      `<p>Your account is ready. You can browse the catalog, add books to your cart, and try checkout with a Stripe test card.</p>
${button(`${SITE()}/product-catalog`, 'Browse Books')}
<p style="font-size:13px;color:#57534e">Didn't create this account? Reply to this email and we will remove it.</p>`,
      `Your account is ready: ${SITE()}/product-catalog\n\nDidn't create this account? Reply to this email and we will remove it.`
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
${ship ? `<td valign="top" style="padding-top:12px;width:50%"><strong>Shipping To</strong><br>${shipLines.map(escapeHtml).join('<br>')}</td>` : ''}
<td valign="top" style="padding-top:12px"><strong>Order Details</strong><br>${o.email ? `Email: ${escapeHtml(o.email)}<br>` : ''}${o.paidWith ? `Paid with: ${escapeHtml(o.paidWith)}` : 'Paid by card (Stripe test mode)'}</td>
</tr></table>
<p style="font-size:13px;color:#57534e">Is the address wrong? Reply to this email before the order ships.</p>`;
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
    ? '<p style="background:#ecfdf5;border:1px solid #a7f3d0;padding:10px;border-radius:6px">This was a Stripe <strong>test</strong> payment, and it has already been refunded. Nothing will ship.</p>'
    : '<p>This was a Stripe test payment. Nothing will ship.</p>';
  return {
    to,
    subject: `Order Confirmation: Order #${o.orderId}`,
    ...layout(
      `Thank You for Your Order, ${o.firstName}`,
      `<p>We have received order <strong>#${o.orderId}</strong>.</p>${refundNote}
<table role="presentation" width="100%" style="font-size:14px">${rows}${totals}</table>
${orderFacts(o).html}
${button(`${SITE()}/account?tab=orders`, 'View Your Orders')}`,
      `Order #${o.orderId}\n${o.lines.map((l) => `- ${l.title} (${l.format}) x${l.quantity}: ${money(l.unitPriceCents * l.quantity)}`).join('\n')}\nSubtotal ${money(o.subtotalCents)}${o.discountCents ? `\nDiscount -${money(o.discountCents)}` : ''}\nTax ${money(o.taxCents)}\nTotal ${money(o.totalCents)}\n${o.refunded ? 'This test payment has been refunded. ' : ''}Nothing will ship.\n${orderFacts(o).text}${SITE()}/account?tab=orders`
    ),
  };
}

const STATUS_TEXT: Record<string, string> = {
  pending: 'is being prepared',
  transit: 'has shipped (simulated shipping for this class project)',
  arrived: 'has been delivered',
  cancelled: 'has been cancelled',
};
const STATUS_SUBJECT: Record<string, (id: number) => string> = {
  pending: (id) => `Update on Your Order #${id}`,
  transit: (id) => `Your Order #${id} Has Shipped`,
  arrived: (id) => `Your Order #${id} Has Been Delivered`,
  cancelled: (id) => `Your Order #${id} Has Been Cancelled`,
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
  const subject = (STATUS_SUBJECT[status] ?? STATUS_SUBJECT.pending)(orderId);
  const shipment = shipmentView(carrier, trackingNumber);

  // The tracking number is real and so is the carrier's page, even though nothing ships
  // from this class project: the number is whatever a staff member typed in.
  const trackingText = shipment
    ? `${shipment.carrierLabel ? `${shipment.carrierLabel} Tracking Number` : 'Tracking Number'}: ${shipment.trackingNumber}`
    : '';
  const trackingHtml = shipment
    ? `<p style="margin:0 0 4px">${escapeHtml(trackingText)}</p>` +
      (shipment.trackingUrl
        ? `<p style="margin:0"><a href="${escapeHtml(shipment.trackingUrl)}" style="color:#1c1917">Track your package on the ${escapeHtml(shipment.carrierLabel ?? 'carrier')} website</a></p>`
        : '')
    : '';

  return {
    to,
    subject,
    ...layout(
      subject,
      `<p>Hello ${escapeHtml(firstName)},</p><p>${escapeHtml(line)}</p>${trackingHtml}${button(ordersUrl, viewUrl ? 'View Your Order' : 'View Your Orders')}`,
      `Hello ${firstName},\n\n${line}\n${trackingText}${shipment?.trackingUrl ? `\nTrack your package: ${shipment.trackingUrl}` : ''}\n${viewUrl ? 'View your order' : 'View your orders'}: ${ordersUrl}`
    ),
  };
}

export function passwordChangedEmail(to: string, firstName: string): Email {
  return {
    to,
    subject: 'Security Alert: Password Changed',
    ...layout(
      'Your Password Was Changed',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>The password for your Book Worms account was just changed, and all other devices were signed out.</p>
${factsTable([['When', whenText()]]).html}
<p><strong>If this was you,</strong> no action is needed.</p>
<p><strong>If this wasn't you,</strong> reset your password immediately and reply to this email so our support team can secure your account.</p>${button(`${SITE()}/forgot-password`, 'Reset Your Password')}`,
      `Hello ${firstName},\n\nThe password for your Book Worms account was just changed, and all other devices were signed out.\nWhen: ${whenText()}\n\nIf this was you, no action is needed.\nIf this wasn't you, reset your password immediately (${SITE()}/forgot-password) and reply to this email.`,
      { security: true }
    ),
  };
}

export function accountDeletedEmail(to: string, firstName: string): Email {
  return {
    to,
    subject: 'Your Book Worms Account Has Been Deleted',
    ...layout(
      'Your Account Has Been Deleted',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>As requested, your Book Worms account has been deleted. Your name, email address, phone number, and saved addresses have been removed, and the account can no longer be used to sign in.</p>
<p>Orders you placed remain in our sales records without your personal details.</p>
<p style="font-size:13px;color:#57534e">Didn't request this? Reply to this email right away.</p>`,
      `Hello ${firstName},\n\nAs requested, your Book Worms account has been deleted. Your name, email address, phone number, and saved addresses have been removed, and the account can no longer be used to sign in. Orders you placed remain in our sales records without your personal details.\n\nDidn't request this? Reply to this email right away.`
    ),
  };
}

export function passwordResetEmail(to: string, firstName: string, token: string): Email {
  const link = `${SITE()}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'Reset Your Book Worms Password',
    ...layout(
      'Reset Your Password',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>We received a request to reset the password for your Book Worms account. This link can be used once and expires in 30 minutes.</p>
${button(link, 'Choose a New Password')}<p style="font-size:13px;color:#57534e">Didn't request this? You can safely ignore this email. Your password will not change.</p>`,
      `Hello ${firstName},\n\nWe received a request to reset the password for your Book Worms account. This link can be used once and expires in 30 minutes:\n${link}\n\nDidn't request this? You can safely ignore this email. Your password will not change.`
    ),
  };
}

export function temporaryPasswordEmail(to: string, firstName: string, portal: 'customer' | 'staff'): Email {
  const where = portal === 'staff' ? `${SITE()}/staff-login` : `${SITE()}/user-login`;
  return {
    to,
    subject: 'Security Alert: Password Reset by Support',
    ...layout(
      'Your Password Was Reset by Our Support Team',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>A member of the Book Worms team set a temporary password on your account. For your security, it is shared with you directly and is never sent by email.</p>
<p>You will be asked to choose a new password the next time you sign in.</p>${button(where, 'Sign In')}
<p style="font-size:13px;color:#57534e">Didn't request this? Reply to this email or <a href="${SUPPORT_LINK()}" style="color:#57534e">contact support</a> right away.</p>`,
      `Hello ${firstName},\n\nA member of the Book Worms team set a temporary password on your account. It is shared with you directly and is never sent by email. You will be asked to choose a new password the next time you sign in: ${where}\n\nDidn't request this? Reply to this email right away.`,
      { security: true }
    ),
  };
}

export function contactReceivedEmail(to: string, name: string): Email {
  return {
    to,
    subject: 'We Received Your Message',
    ...layout(
      `Thank You, ${name}`,
      '<p>We have received your message. A member of our support team will reply from support@bookwrms.store.</p>',
      'We have received your message. A member of our support team will reply from support@bookwrms.store.'
    ),
  };
}

export function contactReplyEmail(to: string, name: string, reply: string, original: string): Email {
  const quote = (s: string) => escapeHtml(s).replace(/\n/g, '<br>');
  return {
    to,
    from: 'support',
    subject: 'Re: Your Message to Book Worms',
    ...layout(
      `Hello ${name}`,
      `<p>${quote(reply)}</p><p style="margin-top:20px;padding-left:12px;border-left:3px solid #d6d3d1;color:#57534e;font-size:13px">Your Message:<br>${quote(original)}</p>`,
      `${reply}\n\n> Your message:\n> ${original.replace(/\n/g, '\n> ')}`
    ),
  };
}

export function lowStockEmail(to: string, items: { title: string; format: string; stock: number; threshold: number }[]): Email {
  const list = items.map((i) => `<li>${escapeHtml(i.title)} (${escapeHtml(i.format)}): <strong>${i.stock}</strong> left (threshold: ${i.threshold})</li>`).join('');
  return {
    to,
    subject: `Low Stock Alert: ${items.length} Item${items.length === 1 ? '' : 's'} Need${items.length === 1 ? 's' : ''} Restocking`,
    ...layout(
      'Low Stock Alert',
      `<p>The following item${items.length === 1 ? ' is' : 's are'} at or below the restock threshold:</p><ul>${list}</ul>${button(`${SITE()}/admin/inventory?filter=low`, 'Open Inventory')}`,
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
      `Thank You, ${name}`,
      `<p>We have received your message and opened support ticket <strong>#${ticketNumber}</strong>. A member of our support team will reply from support@bookwrms.store.</p>
<p style="margin-top:20px;padding-left:12px;border-left:3px solid #d6d3d1;color:#57534e;font-size:13px">Subject: ${escapeHtml(subject)}</p>
<p style="font-size:13px;color:#57534e">To add more information, reply to this email. Your reply will be added to the same ticket.</p>`,
      `We have received your message and opened support ticket #${ticketNumber}. A member of our support team will reply from support@bookwrms.store.\n\nSubject: ${subject}\n\nTo add more information, reply to this email. Your reply will be added to the same ticket.`
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
      `Support Ticket #${opts.ticketNumber}`,
      `<p>${quote(opts.body)}</p>${history}
<p style="font-size:13px;color:#57534e">To continue this conversation, reply to this email. Your reply will be added to ticket #${opts.ticketNumber}.</p>`,
      `${opts.body}\n${opts.quoted ? `\n> Previously:\n> ${opts.quoted.replace(/\n/g, '\n> ')}\n` : ''}\nTo continue this conversation, reply to this email. Your reply will be added to ticket #${opts.ticketNumber}.`
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
    ? '<p style="background:#ecfdf5;border:1px solid #a7f3d0;padding:10px;border-radius:6px">This was a Stripe <strong>test</strong> payment, and it has already been refunded. Nothing will ship.</p>'
    : '<p>This was a Stripe test payment. Nothing will ship.</p>';
  return {
    to,
    subject: `Order Confirmation: Order #${o.orderId}`,
    ...layout(
      'Thank You for Your Order',
      `<p>We have received order <strong>#${o.orderId}</strong>. Because you checked out as a guest, use the link below to view this order. It works for this order only and expires in 30 days.</p>${refundNote}
<table role="presentation" width="100%" style="font-size:14px">${rows}${totals}</table>
${orderFacts(o).html}
${button(link, 'View Your Order')}
<p style="font-size:13px;color:#57534e">For your security, the link asks for this email address before showing the order. You can also look up the order at any time at ${SITE()}/checkout/guest-order using order number <strong>${o.orderId}</strong> and this email address. Creating an account with this email address keeps all your orders in one place.</p>`,
      `Order #${o.orderId}\n${o.lines.map((l) => `- ${l.title} (${l.format}) x${l.quantity}: ${money(l.unitPriceCents * l.quantity)}`).join('\n')}\nSubtotal ${money(o.subtotalCents)}${o.discountCents ? `\nDiscount -${money(o.discountCents)}` : ''}\nTax ${money(o.taxCents)}\nTotal ${money(o.totalCents)}\n${o.refunded ? 'This test payment has been refunded. ' : ''}Nothing will ship.\n${orderFacts(o).text}\nView this order (this order only; expires in 30 days; please don't forward it):\n${link}`
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
    subject: 'Your Book Worms Sign-In Code',
    secret: true,
    ...layout(
      'Your Sign-In Code',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>Use this code to finish signing in to ${where}:</p>
<p style="font-size:30px;letter-spacing:6px;font-weight:bold;font-family:'Courier New',monospace;margin:18px 0">${code}</p>
<p>This code can be used once and expires in 10 minutes. Book Worms staff will never ask you for it.</p>
<p style="font-size:13px;color:#57534e"><strong>Didn't try to sign in?</strong> Someone else may know your password. Change your password now. Without this code, they cannot sign in.</p>${demo}`,
      `Hello ${firstName},\n\nYour Book Worms sign-in code is ${code}. It can be used once and expires in 10 minutes. Book Worms staff will never ask you for it.\n\nDidn't try to sign in? Someone else may know your password. Change your password now.${forAccount ? `\n(Demo account ${forAccount}: its code comes to this shared support inbox.)` : ''}`
    ),
  };
}

/** "Nov 16, 2026, 7:36 PM (Central Time)": when something happened, for emails. */
export function whenText(d = new Date()) {
  return `${d.toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' })} (Central Time)`;
}

/**
 * A security alert: something happened to the account that its owner should know about.
 * `subject` is short ("Account Locked": inboxes cut long subjects off), `title` is the heading
 * inside the email and can say more. `facts` are short "label: value" lines (time, IP address,
 * what changed). `byStaff` means the Book Worms team made the change, so "wasn't you" becomes
 * "didn't request this". `ifYou` replaces the default "If this was you" line; `extra` adds a
 * block at the end (HTML and text).
 */
export function securityAlertEmail(
  to: string,
  firstName: string,
  alert: {
    subject: string;
    title: string;
    body: string;
    facts: [string, string][];
    byStaff?: boolean;
    ifYou?: string;
    action?: { href: string; label: string };
    extra?: { html: string; text: string };
  },
  portal: 'customer' | 'staff'
): Email {
  const resetUrl = portal === 'staff' ? `${SITE()}/staff-login` : `${SITE()}/forgot-password`;
  const ifYou = alert.ifYou ?? (alert.byStaff ? 'If you asked our support team for this change, no action is needed.' : 'If this was you, no action is needed.');
  const ifNot = alert.byStaff
    ? 'If you did not request this change, reply to this email or contact support immediately so we can secure your account.'
    : portal === 'staff'
      ? 'If this wasn\'t you, change your password from the staff portal immediately and notify an administrator.'
      : 'If this wasn\'t you, reset your password immediately and reply to this email so our support team can help secure your account.';
  const lead = (t: string) => {
    const i = t.indexOf(',');
    return `<strong>${escapeHtml(t.slice(0, i + 1))}</strong>${escapeHtml(t.slice(i + 1))}`;
  };
  const action = alert.action ?? (alert.byStaff
    ? { href: SUPPORT_LINK(), label: 'Contact Support' }
    : { href: resetUrl, label: portal === 'staff' ? 'Open the Staff Portal' : 'Reset Your Password' });
  const facts = factsTable(alert.facts);
  return {
    to,
    subject: `Security Alert: ${alert.subject}`,
    ...layout(
      alert.title,
      `<p>Hello ${escapeHtml(firstName)},</p><p>${escapeHtml(alert.body)}</p>${facts.html}
<p>${lead(ifYou)}</p>
${alert.extra ? alert.extra.html : `<p style="background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:6px">${lead(ifNot)}</p>`}
${button(action.href, action.label)}`,
      `Hello ${firstName},\n\n${alert.body}\n\n${facts.text}\n\n${ifYou}\n${alert.extra ? alert.extra.text : ifNot}\n${action.label}: ${action.href}`,
      { security: true }
    ),
  };
}

/** The red "this wasn't you" box with a link, for alerts that offer an undo (e.g. lock again). */
export function undoBox(text: string, href: string, label: string): { html: string; text: string } {
  const i = text.indexOf('?');
  return {
    html: `<div style="background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;margin:16px 0">
<p style="margin:0 0 10px"><strong>${escapeHtml(text.slice(0, i + 1))}</strong>${escapeHtml(text.slice(i + 1))}</p>
<a href="${escapeHtml(href)}" style="display:inline-block;background:#b91c1c;color:#ffffff;padding:9px 16px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></div>`,
    text: `${text}\n${label}: ${href}`,
  };
}

/**
 * Sent to an account's NEW email address after a change, so the new address knows it now
 * receives sign-in codes and password resets. (The old address gets a security alert.)
 */
export function emailChangedConfirmationEmail(to: string, firstName: string, byStaff: boolean): Email {
  const who = byStaff ? 'by the Book Worms support team' : 'from your account settings';
  return {
    to,
    subject: 'Sign-In Email Updated',
    ...layout(
      'Your Sign-In Email Has Been Updated',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>This email address is now the sign-in email for your Book Worms account. The change was made ${who}.</p>
${factsTable([['When', whenText()], ['New sign-in email', to]]).html}
<p>From now on, sign-in codes, password reset links, and order updates will be sent here.</p>
<p style="font-size:13px;color:#57534e">Didn't expect this? Reply to this email or <a href="${SUPPORT_LINK()}" style="color:#57534e">contact support</a>.</p>`,
      `Hello ${firstName},\n\nThis email address is now the sign-in email for your Book Worms account. The change was made ${who}.\nWhen: ${whenText()}\n\nFrom now on, sign-in codes, password reset links, and order updates will be sent here.\n\nDidn't expect this? Reply to this email or contact support: ${SUPPORT_LINK()}`
    ),
  };
}

/** The Book Worms team changed the customer's details (name, phone, ...): what changed and how to object. */
export function accountUpdatedByStaffEmail(to: string, firstName: string, changes: string[]): Email {
  const list = changes.map((c) => `<li>${escapeHtml(c)}</li>`).join('');
  return {
    to,
    subject: 'Account Details Updated',
    ...layout(
      'Your Account Details Were Updated',
      `<p>Hello ${escapeHtml(firstName)},</p>
<p>A member of the Book Worms support team updated the following details on your account:</p>
<ul>${list}</ul>
${factsTable([['When', whenText()]]).html}
<p><strong>If you asked us for this change,</strong> no action is needed.</p>
<p style="background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:6px"><strong>If you did not request this change,</strong> reply to this email or contact support and we will look into it right away.</p>
${button(SUPPORT_LINK(), 'Contact Support')}`,
      `Hello ${firstName},\n\nA member of the Book Worms support team updated the following details on your account:\n${changes.map((c) => `- ${c}`).join('\n')}\nWhen: ${whenText()}\n\nIf you asked us for this change, no action is needed.\nIf you did not request this change, reply to this email or contact support: ${SUPPORT_LINK()}`
    ),
  };
}
