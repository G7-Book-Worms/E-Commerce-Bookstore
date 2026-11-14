// Sends ticket replies from support@ with RFC 5322 threading headers.
//
// This sits beside the shared mailer (../email/mailer.ts) rather than inside it because a
// ticket reply needs three things an ordinary notification does not: a Message-ID we choose
// ourselves (so it can be stored and matched when the customer replies), an In-Reply-To, and a
// References chain. The shared `Email` shape and the "never throw, degrade to the console when
// SMTP is unset" contract are kept identical, so this behaves like the rest of the app's email.
//
// Credentials are read from the environment and never logged.
import nodemailer, { type Transporter } from 'nodemailer';
import { randomUUID } from 'node:crypto';
import type { Email } from '../email/mailer';

let supportTransport: Transporter | null | undefined;

function supportAccount() {
  return { user: process.env.SUPPORT_EMAIL, pass: process.env.SUPPORT_EMAIL_PASSWORD };
}

/** The domain our own Message-IDs are minted under. */
function messageIdDomain(): string {
  const user = process.env.SUPPORT_EMAIL ?? '';
  const domain = user.split('@')[1]?.trim();
  return domain || 'bookwrms.store';
}

/** A fresh Message-ID for an outbound reply, without the angle brackets. */
export function newOutboundMessageId(): string {
  return `ticket-${randomUUID()}@${messageIdDomain()}`;
}

function transport(): Transporter | null {
  const { user, pass } = supportAccount();
  if (!process.env.SMTP_HOST || !user || !pass) return null;
  if (supportTransport === undefined) {
    const port = Number(process.env.SMTP_PORT || 465);
    supportTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // TLS from the first byte
      requireTLS: true,
      auth: { user, pass },
      tls: { minVersion: 'TLSv1.2' }, // the server certificate is verified (nodemailer default)
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    });
  }
  return supportTransport;
}

export interface ThreadedSendResult {
  /** Whether SMTP actually accepted it. False when email is not configured here. */
  emailed: boolean;
  /** The Message-ID we sent it under, stored so the customer's reply can be threaded. */
  messageId: string;
}

/**
 * Sends one ticket reply from support@. Never throws: a failed email must not lose the reply
 * that has already been written into the thread, so the caller stores the message either way
 * and shows `emailed` to the staff member.
 */
export async function sendThreadedEmail(
  email: Email,
  thread: { messageId: string; inReplyTo?: string | null; references?: string | null }
): Promise<ThreadedSendResult> {
  const t = transport();
  const fromAddress = supportAccount().user ?? 'support@bookwrms.store';
  if (!t) {
    // No credentials: say so without printing the body, which is customer correspondence.
    console.info(`[email:dev] (SMTP not configured) ticket reply to=${email.to} subject="${email.subject}"`);
    return { emailed: false, messageId: thread.messageId };
  }
  try {
    await t.sendMail({
      from: `"Book Worms Support" <${fromAddress}>`,
      replyTo: fromAddress,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      // Angle brackets are what goes on the wire; the bare id is what we store.
      messageId: `<${thread.messageId}>`,
      ...(thread.inReplyTo ? { inReplyTo: `<${thread.inReplyTo}>` } : {}),
      ...(thread.references ? { references: thread.references } : {}),
    });
    return { emailed: true, messageId: thread.messageId };
  } catch (err) {
    // Subject only. The body is never logged.
    console.error('[email] ticket reply failed to send:', err instanceof Error ? err.message : 'unknown error');
    return { emailed: false, messageId: thread.messageId };
  }
}
