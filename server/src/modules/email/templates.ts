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
export interface OrderEmailData {
  orderId: number;
  firstName: string;
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
${button(`${SITE()}/account?tab=orders`, 'View your orders')}`,
      `Order #${o.orderId}\n${o.lines.map((l) => `- ${l.title} (${l.format}) x${l.quantity}: ${money(l.unitPriceCents * l.quantity)}`).join('\n')}\nSubtotal ${money(o.subtotalCents)}${o.discountCents ? `\nDiscount -${money(o.discountCents)}` : ''}\nTax ${money(o.taxCents)}\nTotal ${money(o.totalCents)}\n${o.refunded ? 'This test payment has been refunded. ' : ''}Nothing will ship.\n${SITE()}/account?tab=orders`
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
 * The "your order moved on" email. `trackingNumber` is the raw `orders.tracking_number`
 * value, which carries the carrier too (see modules/orders/carriers.ts); when a carrier is
 * known the email carries a link to that carrier's own tracking page.
 */
export function orderStatusEmail(to: string, firstName: string, orderId: number, status: string, trackingNumber?: string | null): Email {
  const line = `Your order #${orderId} ${STATUS_TEXT[status] ?? `is now "${status}"`}.`;
  const shipment = shipmentView(trackingNumber);

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
      `<p>${escapeHtml(line)}</p>${trackingHtml}${button(`${SITE()}/account?tab=orders`, 'View your orders and their status')}`,
      `${line}\n${trackingText}${shipment?.trackingUrl ? `\nTrack it: ${shipment.trackingUrl}` : ''}\nView your orders and their status: ${SITE()}/account?tab=orders`
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
